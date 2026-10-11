/**
 * onboardingService.js - Voice Onboarding & Calibration Service for LedgerVoice
 * Manages the 6 essential calibration exercises, practice validation API calls,
 * and progress persistence via the backend.
 */
app.factory('onboardingService', ['apiService', '$q', function(apiService, $q) {

  // ═══════════════════════════════════════════════════════════
  // EXACTLY 4 ESSENTIAL CALIBRATION COMMANDS
  // ═══════════════════════════════════════════════════════════

  var EXERCISES = [
    {
      id: 'CMD_1',
      number: 1,
      title: 'Basic Single-Item Transaction',
      phrase: 'Sold 2 kg rice for 120 rupees.',
      hint: 'Speak clearly: transaction type (Sale), product (Rice), quantity (2 kg), amount (₹120).',
      expected: {
        transaction_type: 'sale',
        amount: 120,
        items: [
          { name: 'Rice', qty: 2, unit: 'kg', amount: 120 }
        ]
      },
      icon: 'fa-cart-shopping'
    },
    {
      id: 'CMD_2',
      number: 2,
      title: 'Fractional Quantity',
      phrase: 'Sold half kg wheat for 50 rupees.',
      hint: 'Speak fractional quantities naturally: "half kg wheat for 50 rupees".',
      expected: {
        transaction_type: 'sale',
        amount: 50,
        items: [
          { name: 'Wheat', qty: 0.5, unit: 'kg', amount: 50 }
        ]
      },
      icon: 'fa-scale-balanced'
    },
    {
      id: 'CMD_3',
      number: 3,
      title: 'Two-Item Command',
      phrase: 'Items list: 5 kg wheat 200 rupees, 2 liter oil for 300 rupees.',
      hint: 'Speak both items independently: Wheat (5 kg, ₹200) and Oil (2 liters, ₹300).',
      expected: {
        amount: 500,
        items: [
          { name: 'Wheat', qty: 5, unit: 'kg', amount: 200 },
          { name: 'Oil', qty: 2, unit: 'litre', amount: 300 }
        ]
      },
      icon: 'fa-list-check'
    },
    {
      id: 'CMD_4',
      number: 4,
      title: 'Credit Transaction with a Deadline',
      phrase: 'Ramesh bought 2 kg rice for 200 rupees on credit, payable by 20 October 2026.',
      hint: 'Customer (Ramesh), Rice (2 kg, ₹200), credit status, and due date (20 October 2026).',
      expected: {
        customer_name: 'Ramesh',
        transaction_type: 'sale',
        payment_status: 'credit',
        amount: 200,
        due_date: '2026-10-20',
        items: [
          { name: 'Rice', qty: 2, unit: 'kg', amount: 200 }
        ]
      },
      icon: 'fa-calendar-check'
    }
  ];

  var TOTAL_EXERCISES = EXERCISES.length; // Exactly 4

  return {
    EXERCISES: EXERCISES,
    TOTAL_EXERCISES: TOTAL_EXERCISES,

    getAllExercises: function() {
      return EXERCISES;
    },

    getExerciseByNumber: function(num) {
      return EXERCISES[num - 1] || null;
    },

    isCompleted: function(progressData) {
      if (!progressData) return false;
      return !!progressData.voice_onboarding_completed;
    },

    // Backend API calls
    loadProgress: function() {
      return apiService.get('/voice/onboarding-progress/');
    },

    saveProgress: function(data) {
      return apiService.put('/voice/onboarding-progress/', data);
    },

    validatePractice: function(transcript, expected) {
      return apiService.post('/voice/validate-practice/', {
        transcript: transcript,
        expected: expected
      });
    }
  };
}]);
