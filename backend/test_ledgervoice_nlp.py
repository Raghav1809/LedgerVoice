import os
import sys
import django

# Set up Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'voicekhata_backend.settings')
django.setup()

from voice.parsers import parse_speech_transcript

def test_nlp():
    test_cases = [
        {
            "input": "10 liters oil at 50 rupees per liter",
            "expected_items": [{"name": "Oil", "qty": 10.0, "unit": "litre", "price": 50.0, "total": 500.0}],
            "expected_customer": None
        },
        {
            "input": "5 kg rice at 60 rupees per kg",
            "expected_items": [{"name": "Rice", "qty": 5.0, "unit": "kg", "price": 60.0, "total": 300.0}],
            "expected_customer": None
        },
        {
            "input": "3 notebooks at 40 rupees each",
            "expected_items": [{"name": "Notebooks", "qty": 3.0, "unit": "pcs", "price": 40.0, "total": 120.0}],
            "expected_customer": None
        },
        {
            "input": "10 liters oil at 50 rupees per liter and 5 kg rice at 60 rupees per kg",
            "expected_items": [
                {"name": "Oil", "qty": 10.0, "unit": "litre", "price": 50.0, "total": 500.0},
                {"name": "Rice", "qty": 5.0, "unit": "kg", "price": 60.0, "total": 300.0}
            ],
            "expected_customer": None
        },
        {
            # User's exact test case: multi-item without commas, fractional quantity
            "input": "items list sugar 2kg 80 rupees oil 2 liter 100 rupees wheat 1 and half kg 90 rupees",
            "expected_items": [
                {"name": "Sugar", "qty": 2.0, "unit": "kg", "price": 40.0, "total": 80.0},
                {"name": "Oil", "qty": 2.0, "unit": "litre", "price": 50.0, "total": 100.0},
                {"name": "Wheat", "qty": 1.5, "unit": "kg", "price": 60.0, "total": 90.0}
            ],
            "expected_customer": None
        },
        {
            # Fractions with 'half kg', '1 and a half ltr'
            "input": "sugar half kg 40 rupees and oil 1 and a half ltr 150 rupees",
            "expected_items": [
                {"name": "Sugar", "qty": 0.5, "unit": "kg", "price": 80.0, "total": 40.0},
                {"name": "Oil", "qty": 1.5, "unit": "litre", "price": 100.0, "total": 150.0}
            ],
            "expected_customer": None
        },
        {
            # Slash fractions and commas
            "input": "1/2 kg sugar for 40 rupees, 1 and 1/2 kg rice for 90 rupees",
            "expected_items": [
                {"name": "Sugar", "qty": 0.5, "unit": "kg", "price": 80.0, "total": 40.0},
                {"name": "Rice", "qty": 1.5, "unit": "kg", "price": 60.0, "total": 90.0}
            ],
            "expected_customer": None
        },
        {
            # Items list ending with 'sold to <Customer>'
            "input": "items list sugar 2kg 80 rupees oil 2 liter 100 rupees wheat 1 and half kg 90 rupees sold to Rahul",
            "expected_items": [
                {"name": "Sugar", "qty": 2.0, "unit": "kg", "price": 40.0, "total": 80.0},
                {"name": "Oil", "qty": 2.0, "unit": "litre", "price": 50.0, "total": 100.0},
                {"name": "Wheat", "qty": 1.5, "unit": "kg", "price": 60.0, "total": 90.0}
            ],
            "expected_customer": "Rahul"
        },
        {
            # Items list ending with 'sold by <Customer>'
            "input": "items list sugar 2kg 80 rupees sold by Alex",
            "expected_items": [
                {"name": "Sugar", "qty": 2.0, "unit": "kg", "price": 40.0, "total": 80.0}
            ],
            "expected_customer": "Alex"
        },
        {
            # Items list with phone and customer
            "input": "sugar 2kg 80 rupees to Amit phone 9876543210",
            "expected_items": [
                {"name": "Sugar", "qty": 2.0, "unit": "kg", "price": 40.0, "total": 80.0}
            ],
            "expected_customer": "Amit",
            "expected_phone": "9876543210"
        }
    ]

    passed = True
    print("=" * 60)
    print("RUNNING LEDGERVOICE NLP PARSING TESTS")
    print("=" * 60)

    for i, tc in enumerate(test_cases, 1):
        print(f"\nTest #{i}: '{tc['input']}'")
        res = parse_speech_transcript(tc['input'])
        print(f"Is Sales: {res.get('is_sales')}")
        items = res.get("items")
        customer = res.get("customer_name")
        phone = res.get("customer_phone")
        print(f"Parsed Items: {items}")
        print(f"Parsed Customer: {customer}, Phone: {phone}")
        
        expected = tc["expected_items"]
        if not items:
            print("[ERROR] FAILED: No items parsed")
            passed = False
            continue

        if len(items) != len(expected):
            print(f"[ERROR] FAILED: Expected {len(expected)} items, got {len(items)}")
            passed = False
            continue

        item_match = True
        for actual_item, exp_item in zip(items, expected):
            for k, v in exp_item.items():
                actual_val = actual_item.get(k)
                if actual_val != v:
                    print(f"[ERROR] FAILED mismatch on {k}: Expected {v}, got {actual_val}")
                    item_match = False
                    passed = False

        if tc.get("expected_customer") is not None:
            if customer != tc["expected_customer"]:
                print(f"[ERROR] FAILED customer mismatch: Expected {tc['expected_customer']}, got {customer}")
                item_match = False
                passed = False

        if tc.get("expected_phone") is not None:
            if phone != tc["expected_phone"]:
                print(f"[ERROR] FAILED phone mismatch: Expected {tc['expected_phone']}, got {phone}")
                item_match = False
                passed = False
                    
        if item_match:
            print("[SUCCESS] PASSED")

    print("\n" + "=" * 60)
    if passed:
        print("ALL NLP TESTS PASSED SUCCESSFUL!")
    else:
        print("SOME NLP TESTS FAILED!")
    print("=" * 60)

if __name__ == '__main__':
    test_nlp()
