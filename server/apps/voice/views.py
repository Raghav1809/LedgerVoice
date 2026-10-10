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
