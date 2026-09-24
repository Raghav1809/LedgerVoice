from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .parsers import parse_speech_transcript


class SpeechParseView(APIView):
    """
    POST /api/voice/parse/
    Body: { "transcript": "Rahul borrowed 500 rupees will pay in 2 weeks" }
    Returns structured transaction data extracted by spaCy NLP + rule-based parser.
    No authentication required — runs fully local.
    """
    permission_classes = [permissions.AllowAny]

    def _enrich_items_with_inventory(self, items, user=None):
        """
        Post-process parsed sales items with inventory price lookup.
        Pricing priority:
          1. Explicit price from voice (item already has price > 0)
          2. Inventory price (case-insensitive product lookup)
          3. Missing — frontend will ask user during confirmation
        """
        if not items:
            return items

        try:
            from inventory.models import InventoryItem
            from inventory.views import convert_inventory_price, UNIT_CONVERSIONS
            from transactions.views import get_local_user

            target_user = user or get_local_user()

            for item in items:
                if item.get('price', 0) > 0 and item.get('total', 0) > 0:
                    item['price_source'] = 'voice'
                else:
                    inv_item = InventoryItem.objects.filter(
                        user=target_user,
                        product_name__iexact=item.get('name', '').strip()
                    ).first()

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
                        item['inventory_unit'] = inv_item.unit
                        item['inventory_price'] = float(inv_item.price)
                    else:
                        item['price_source'] = 'missing'
        except Exception:
            # Inventory enrichment is optional — silently skip on any error
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

        # Enrich sales items with inventory prices
        if parsed_data.get('items') and isinstance(parsed_data['items'], list):
            from transactions.views import get_request_user
            user = get_request_user(request)
            parsed_data['items'] = self._enrich_items_with_inventory(parsed_data['items'], user=user)

            # Recalculate total amount from enriched items
            total = sum(
                float(item.get('total', 0))
                for item in parsed_data['items']
            )
            if total > 0:
                parsed_data['amount'] = round(total, 2)

        return Response(parsed_data, status=status.HTTP_200_OK)
