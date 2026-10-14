/**
 * onboardingService.js - Voice Onboarding & Calibration Service for LedgerVoice
 * Manages the 6 essential calibration exercises, practice validation API calls,
 * and progress persistence via the backend.
 */
app.factory('onboardingService', ['apiService', '$q', function (apiService, $q) {

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
      phrase: 'Sold half litre milk for 30 rupees.',
      hint: 'Speak fractional quantities naturally: "half litre milk for 30 rupees".',
      expected: {
        transaction_type: 'sale',
        amount: 30,
        items: [
          { name: 'Milk', qty: 0.5, unit: 'litre', amount: 30 }
        ]
      },
      icon: 'fa-scale-balanced'
    },

    {
      id: 'CMD_3',
      number: 3,
      title: 'Two-Item Command',
      phrase: 'Sold 2 kg rice for 100 rupees and 1 litre milk for 30 rupees.',
      hint: 'Speak both items clearly: Rice (2 kg, ₹100) and Milk (1 litre, ₹30).',
      expected: {
        transaction_type: 'sale',
        amount: 130,
        items: [
          { name: 'Rice', qty: 2, unit: 'kg', amount: 100 },
          { name: 'Milk', qty: 1, unit: 'litre', amount: 30 }
        ]
      },
      icon: 'fa-list-check'
    },
    {

      id: 'CMD_4',
      number: 4,
      title: 'Transaction with a Deadline',
      phrase: 'Amit bought 1 kg sugar for 50 rupees, payable by 25 October 2026.',
      hint: 'Customer (Amit), Sugar (1 kg, ₹50), and due date (25 October 2026).',
      expected: {
        customer_name: 'Amit',
        transaction_type: 'sale',
        amount: 50,
        due_date: '2026-10-25',
        items: [
          { name: 'Sugar', qty: 1, unit: 'kg', amount: 50 }
        ]
      },
      icon: 'fa-calendar-check'
    }
  ];

  var TOTAL_EXERCISES = EXERCISES.length; // Exactly 4

  return {
    EXERCISES: EXERCISES,
    TOTAL_EXERCISES: TOTAL_EXERCISES,

    getAllExercises: function () {
      return EXERCISES;
    },

    getExerciseByNumber: function (num) {
      return EXERCISES[num - 1] || null;
    },

    isCompleted: function (progressData) {
      if (!progressData) return false;
      return !!progressData.voice_onboarding_completed;
    },

    // Backend API calls
    loadProgress: function () {
      return apiService.get('/voice/onboarding-progress/');
    },

    saveProgress: function (data) {
      return apiService.put('/voice/onboarding-progress/', data);
    },

    validatePractice: function (transcript, expected) {
      return apiService.post('/voice/validate-practice/', {
        transcript: transcript,
        expected: expected
      });
    }
  };
}]);
