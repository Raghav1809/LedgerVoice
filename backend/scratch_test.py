import os
import sys
import django
import json

# Set up Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'voicekhata_backend.settings')
django.setup()

from voice.parsers import parse_speech_transcript

def run_tests():
    test_cases = [
        # Standard Transactions
        "Deepak paid me 500 rupees",
        "gave 200 to Rahul",
        "Deepak borrowed 1000 from uncle in 5 days",
        "got 250 payment from amit today",
        "spent 150 on stationery",
        
        # Sales/Item Transactions
        "items list: sugar 2kg 100, wheat 5kg 150",
        "sold 5kg sugar at 50, 1 dozen eggs for 60",
        "chocolates 150",
        "rice 10kg for 400 and milk 2 liters for 120",

        # Due Date Relative and Specific Tests
        "borrowed 500 return tomorrow",
        "borrowed 1000 and will pay next day",
        "took 800 rupees return in 3 days",
        "credited 1200 rupees pay in a month",
        "borrowed 2500 return in 2 months",
        "Uncle gave 3000 due in 3 month",
        "gave 500 to rahul due on 1 september",
        "borrowed 1500 return september 1st",
        "took 600 pay 1st of september",
        "borrowed 1000 due next week",
        "paid 400 but borrowed 600 pay in a week",
        "borrowed 500 due tomarrow",
        "borrowed 700 due in 2 weeks",

        # Mobile Number Extraction Tests
        "Deepak borrowed 1000 rupees phone number 9876543210",
        "sold 5kg sugar for 250 mobile 98765-43210",
        "gave 500 to rahul 9876543210",
        "Amit paid me 200 rupees contact number +91 9999888877 tomorrow"
    ]
    
    print("=" * 80)
    print("RUNNING SPACY NLP INFORMATION EXTRACTION TESTS")
    print("=" * 80)
    
    for i, tc in enumerate(test_cases, 1):
        print(f"\nTest #{i}: '{tc}'")
        try:
            result = parse_speech_transcript(tc)
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
            
    print("=" * 80)
    print("TESTING COMPLETE")
    print("=" * 80)

if __name__ == '__main__':
    run_tests()
