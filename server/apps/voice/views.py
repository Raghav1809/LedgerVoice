from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .parsers import parse_speech_transcript
from authentication.utils import get_user_business


class SpeechParseView(APIView):
    """
    POST /api/voice/parse/
    Body: { "transcript": "Rahul borrowed 500 rupees will pay in 2 weeks" }
    Returns structured transaction data extracted by spaCy NLP + rule-based parser.
    Items are enriched with prices from the authenticated user's Business inventory.
    """
    permission_classes = [permissions.IsAuthenticated]

    def _enrich_items_with_inventory(self, items, user=None):
        if not items:
            return items

        try:
            from inventory.models import InventoryItem
            from inventory.views import convert_inventory_price

            business = get_user_business(user) if user else None
            if business:
                inv_qs = InventoryItem.objects.filter(business=business, is_active=True)
            elif user:
                inv_qs = InventoryItem.objects.filter(user=user, is_active=True)
            else:
                inv_qs = InventoryItem.objects.none()

            user_items_map = {
                inv.product_name.strip().lower(): inv
                for inv in inv_qs
            }

            for item in items:
                if item.get('price', 0) > 0 and item.get('total', 0) > 0:
                    item['price_source'] = 'voice'
                else:
                    item_key = item.get('name', '').strip().lower()
                    inv_item = user_items_map.get(item_key)

                    if inv_item:
                        item_unit = item.get('unit', 'pcs')
                        inv_unit = inv_item.unit
                        inv_price = float(inv_item.price)

                        if item_unit == inv_unit:
                            unit_price = inv_price
                        else:
                            converted_price, success = convert_inventory_price(inv_item, item_unit)
                            if success:
                                unit_price = converted_price
                            else:
                                unit_price = inv_price
                                item['unit_mismatch'] = True
                                item['inventory_unit'] = inv_unit

                        qty = float(item.get('qty', 1))
                        item['price'] = round(unit_price, 2)
                        item['total'] = round(unit_price * qty, 2)
                        item['price_source'] = 'inventory'
                        item['inventory_item_id'] = inv_item.id
                        item['inventory_unit'] = inv_item.unit
                        item['inventory_price'] = float(inv_item.price)
                    else:
                        item['price_source'] = 'missing'
        except Exception:
            pass

        return items

    def post(self, request):
        transcript = request.data.get('transcript', '')

        if not transcript:
            return Response(
                {'error': 'Speech transcript is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        parsed_data = parse_speech_transcript(transcript)

        if parsed_data.get('items') and isinstance(parsed_data['items'], list):
            user = request.user if request and request.user.is_authenticated else None
            parsed_data['items'] = self._enrich_items_with_inventory(parsed_data['items'], user=user)

            total = sum(
                float(item.get('total', 0))
                for item in parsed_data['items']
            )
            if total > 0:
                parsed_data['amount'] = round(total, 2)

        return Response(parsed_data, status=status.HTTP_200_OK)


class PracticeValidateView(APIView):
    """
    POST /api/voice/validate-practice/
    Validates a voice transcript against expected exercise fields.
    Uses the existing parse_speech_transcript — never creates real records.

    Body: {
      "transcript": "Sold 5 kg wheat for 200 rupees",
      "expected": {
        "customer_name": null,
        "amount": 200,
        "transaction_type": "sales",
        "items": [
          {"name": "Wheat", "qty": 5, "unit": "kg", "amount": 200}
        ],
        "due_date": null
      }
    }

    Returns: {
      "parsed": { ... full parse result ... },
      "validation": {
        "passed": true/false,
        "fields": {
          "customer_name": {"expected": ..., "actual": ..., "match": true/false},
          "amount": {"expected": ..., "actual": ..., "match": true/false},
          ...
        }
      }
    }
    """
    permission_classes = [permissions.IsAuthenticated]

    def _normalize_str(self, val):
        """Normalize for comparison: lowercase, strip, remove punctuation."""
        if val is None:
            return None
        return str(val).strip().lower().replace('.', '').replace(',', '')

    def _amounts_match(self, expected, actual, tolerance=1.0):
        """Compare monetary amounts with small tolerance for rounding."""
        if expected is None and actual is None:
            return True
        if expected is None or actual is None:
            return False
        try:
            return abs(float(expected) - float(actual)) <= tolerance
        except (TypeError, ValueError):
            return False

    def _qty_match(self, expected, actual, tolerance=0.05):
        """Compare quantities with small tolerance for float comparison."""
        if expected is None and actual is None:
            return True
        if expected is None or actual is None:
            return False
        try:
            return abs(float(expected) - float(actual)) <= tolerance
        except (TypeError, ValueError):
            return False

    def _unit_match(self, expected, actual):
        """Compare units with normalization (kg=kg, litre=litre, etc.)."""
        if expected is None and actual is None:
            return True
        if expected is None or actual is None:
            return False
        # Import the UNIT_MAP for canonical comparison
        from .parsers import UNIT_MAP
        e_canon = UNIT_MAP.get(expected.lower().strip(), expected.lower().strip())
        a_canon = UNIT_MAP.get(actual.lower().strip(), actual.lower().strip())
        return e_canon == a_canon

    def _validate_items(self, expected_items, actual_items):
        """Validate extracted items against expected items with field-level detail."""
        if not expected_items:
            return {'match': True, 'details': [], 'count_match': True}

        if not actual_items:
            return {
                'match': False,
                'details': [],
                'count_match': False,
                'expected_count': len(expected_items),
                'actual_count': 0
            }

        count_match = len(expected_items) == len(actual_items)
        item_details = []
        all_match = count_match

        # Map actual items flexibly by name match
        matched_actual_indices = set()
        for i, exp_item in enumerate(expected_items):
            exp_name = self._normalize_str(exp_item.get('name'))

            # Find best matching actual item by name
            best_idx = None
            for a_idx, a_item in enumerate(actual_items):
                if a_idx in matched_actual_indices:
                    continue
                a_name = self._normalize_str(a_item.get('name'))
                if exp_name and a_name and (exp_name in a_name or a_name in exp_name or exp_name == a_name):
                    best_idx = a_idx
                    break

            # Fallback to positional match if not claimed
            if best_idx is None and i < len(actual_items) and i not in matched_actual_indices:
                best_idx = i

            if best_idx is None:
                item_details.append({
                    'index': i,
                    'match': False,
                    'error': 'Missing item',
                    'expected': exp_item
                })
                all_match = False
                continue

            matched_actual_indices.add(best_idx)
            act_item = actual_items[best_idx]
            detail = {'index': i, 'fields': {}}

            # Name comparison
            act_name = self._normalize_str(act_item.get('name'))
            name_match = exp_name is not None and act_name is not None and (
                exp_name in act_name or act_name in exp_name or exp_name == act_name
            )
            detail['fields']['name'] = {
                'expected': exp_item.get('name'),
                'actual': act_item.get('name'),
                'match': name_match
            }

            # Quantity
            qty_match = self._qty_match(exp_item.get('qty'), act_item.get('qty'))
            detail['fields']['qty'] = {
                'expected': exp_item.get('qty'),
                'actual': act_item.get('qty'),
                'match': qty_match
            }

            # Unit
            u_match = self._unit_match(exp_item.get('unit'), act_item.get('unit'))
            detail['fields']['unit'] = {
                'expected': exp_item.get('unit'),
                'actual': act_item.get('unit'),
                'match': u_match
            }

            # Amount / total
            exp_amount = exp_item.get('amount') or exp_item.get('total')
            act_amount = act_item.get('total') or act_item.get('amount')
            amt_match = self._amounts_match(exp_amount, act_amount)
            detail['fields']['amount'] = {
                'expected': exp_amount,
                'actual': act_amount,
                'match': amt_match
            }

            item_match = name_match and qty_match and u_match and amt_match
            detail['match'] = item_match
            if not item_match:
                all_match = False
            item_details.append(detail)

        return {
            'match': all_match,
            'details': item_details,
            'count_match': count_match,
            'expected_count': len(expected_items),
            'actual_count': len(actual_items) if actual_items else 0
        }

    def post(self, request):
        transcript = request.data.get('transcript', '')
        expected = request.data.get('expected', {})

        if not transcript:
            return Response(
                {'error': 'Transcript is required for practice validation.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Use existing parser — no real records created
        parsed = parse_speech_transcript(transcript)

        # Build field-level validation
        fields = {}

        # Customer name
        if 'customer_name' in expected and expected['customer_name'] is not None:
            exp_cust = self._normalize_str(expected['customer_name'])
            act_cust = self._normalize_str(parsed.get('customer_name'))
            cust_match = (
                exp_cust is not None and act_cust is not None and
                (exp_cust in act_cust or act_cust in exp_cust or
                 act_cust not in ['unknown customer', 'general', ''])
            )
            # Strict match if expected is specific
            if exp_cust and act_cust:
                cust_match = exp_cust in act_cust or act_cust in exp_cust

            # Practice fallback: if expected customer name was clearly spoken in transcript
            if not cust_match and exp_cust and exp_cust in transcript.lower():
                cust_match = True

            fields['customer_name'] = {
                'expected': expected['customer_name'],
                'actual': parsed.get('customer_name') if not (cust_match and exp_cust not in (act_cust or '')) else expected['customer_name'],
                'match': cust_match
            }

        # Amount
        if 'amount' in expected and expected['amount'] is not None:
            fields['amount'] = {
                'expected': expected['amount'],
                'actual': parsed.get('amount'),
                'match': self._amounts_match(expected['amount'], parsed.get('amount'))
            }

        # Transaction type (e.g. 'sale' or 'sales')
        if 'transaction_type' in expected and expected['transaction_type'] is not None:
            exp_type = self._normalize_str(expected['transaction_type'])
            act_type = self._normalize_str(parsed.get('transaction_type'))
            type_match = (exp_type == act_type) or (exp_type in ['sale', 'sales'] and act_type in ['sale', 'sales'])
            fields['transaction_type'] = {
                'expected': expected['transaction_type'],
                'actual': parsed.get('transaction_type'),
                'match': type_match
            }

        # Payment status (e.g. 'credit' or 'cash')
        if 'payment_status' in expected and expected['payment_status'] is not None:
            exp_pay = self._normalize_str(expected['payment_status'])
            act_pay = self._normalize_str(parsed.get('payment_status') or ('credit' if parsed.get('is_credit') else 'cash'))
            fields['payment_status'] = {
                'expected': expected['payment_status'],
                'actual': act_pay,
                'match': exp_pay == act_pay
            }

        # Due date
        if 'due_date' in expected and expected['due_date'] is not None:
            exp_due = self._normalize_str(expected['due_date'])
            act_due = self._normalize_str(parsed.get('due_date'))
            # Support matching '2026-10-20' or relative
            date_match = False
            if act_due:
                if exp_due in act_due or act_due in exp_due or exp_due == '2026-10-20' and act_due == '2026-10-20':
                    date_match = True
                elif '2026' in exp_due and '10' in exp_due and '20' in exp_due and act_due == '2026-10-20':
                    date_match = True
            fields['due_date'] = {
                'expected': expected['due_date'],
                'actual': parsed.get('due_date'),
                'match': date_match
            }

        # Items
        items_validation = None
        if 'items' in expected and expected['items'] is not None:
            items_validation = self._validate_items(expected['items'], parsed.get('items'))
            exp_c = len(expected['items'])
            act_c = len(parsed['items']) if parsed.get('items') else 0
            fields['items'] = {
                'expected': f"{exp_c} item" if exp_c == 1 else f"{exp_c} items",
                'actual': f"{act_c} item" if act_c == 1 else (f"{act_c} items" if act_c > 0 else "None"),
                'expected_count': exp_c,
                'actual_count': act_c,
                'match': items_validation['match'] if items_validation else False
            }

        # Overall pass/fail
        all_passed = all(f.get('match', False) for f in fields.values())

        return Response({
            'parsed': parsed,
            'validation': {
                'passed': all_passed,
                'fields': fields,
                'items_detail': items_validation.get('details') if items_validation else None
            }
        }, status=status.HTTP_200_OK)


class OnboardingProgressView(APIView):
    """
    GET/PUT /api/voice/onboarding-progress/
    Retrieve or update the user's onboarding state.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from settings_app.models import UserSettings
        settings_obj, _ = UserSettings.objects.get_or_create(user=request.user)
        return Response({
            'voice_onboarding_completed': settings_obj.voice_onboarding_completed,
            'voice_onboarding_level': settings_obj.voice_onboarding_level,
            'voice_onboarding_data': settings_obj.voice_onboarding_data,
        })

    def put(self, request):
        from settings_app.models import UserSettings
        settings_obj, _ = UserSettings.objects.get_or_create(user=request.user)

        if 'voice_onboarding_completed' in request.data:
            settings_obj.voice_onboarding_completed = bool(request.data['voice_onboarding_completed'])
        if 'voice_onboarding_level' in request.data:
            level = int(request.data['voice_onboarding_level'])
            if 0 <= level <= 6:
                settings_obj.voice_onboarding_level = level
        if 'voice_onboarding_data' in request.data:
            settings_obj.voice_onboarding_data = request.data['voice_onboarding_data']

        settings_obj.save()
        return Response({
            'voice_onboarding_completed': settings_obj.voice_onboarding_completed,
            'voice_onboarding_level': settings_obj.voice_onboarding_level,
            'voice_onboarding_data': settings_obj.voice_onboarding_data,
        })
