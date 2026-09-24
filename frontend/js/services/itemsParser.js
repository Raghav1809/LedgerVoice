/**
 * itemsParser.js - Client-side NLP & Item Parsing Service for LedgerVoice
 * Accurately parses fractional quantities ('half', '1 and half', 'quarter', '1/2')
 * and continuous multi-item streams without delimiters.
 */
app.factory('itemsParserService', ['inventoryService', function(inventoryService) {

  var UNIT_MAP = {
    'kg': 'kg', 'kgs': 'kg', 'kilo': 'kg', 'kilos': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    'g': 'g', 'gm': 'g', 'gms': 'g', 'gram': 'g', 'grams': 'g',
    'litre': 'litre', 'litres': 'litre', 'liter': 'litre', 'liters': 'litre', 'ltr': 'litre', 'l': 'litre',
    'ml': 'ml', 'millilitre': 'ml', 'millilitres': 'ml', 'milliliter': 'ml', 'milliliters': 'ml',
    'pcs': 'pcs', 'piece': 'pcs', 'pieces': 'pcs', 'pc': 'pcs', 'unit': 'pcs', 'units': 'pcs',
    'dozen': 'dozen', 'doz': 'dozen', 'dozens': 'dozen',
    'packet': 'packet', 'packets': 'packet', 'pkt': 'packet',
    'box': 'box', 'boxes': 'box',
    'bag': 'bag', 'bags': 'bag',
    'bundle': 'bundle', 'bundles': 'bundle',
    'meter': 'mtr', 'metre': 'mtr', 'mtr': 'mtr', 'meters': 'mtr', 'metres': 'mtr',
    'ft': 'ft', 'feet': 'ft', 'foot': 'ft'
  };

  var WORD_TO_NUM = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'twenty': 20, 'twenty five': 25, 'thirty': 30, 'forty': 40, 'fifty': 50,
    'hundred': 100, 'half': 0.5, 'quarter': 0.25, 'to': 2, 'too': 2
  };

  function parseQuantityVal(qtyStr) {
    if (!qtyStr) return 1.0;
    var s = String(qtyStr).toLowerCase().trim();
    s = s.replace(/^(?:a\s+)?half(?:\s+a)?$/, 'half');
    s = s.replace(/^(?:a\s+)?quarter$/, 'quarter');

    // "1 and 1/2", "2 and 3/4"
    var mAndFrac = s.match(/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+and\s+(?:a\s+)?(\d+)\/(\d+)$/i);
    if (mAndFrac) {
      var w1 = mAndFrac[1];
      var baseVal1 = !isNaN(w1) ? parseFloat(w1) : (WORD_TO_NUM[w1] || 1.0);
      var n1 = parseFloat(mAndFrac[2]);
      var d1 = parseFloat(mAndFrac[3]);
      if (d1 !== 0) return Math.round((baseVal1 + (n1 / d1)) * 1000) / 1000;
    }

    // Compound phrases: "1 and half", "one and a half", "2 and half"
    var mCompound = s.match(/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|to|too)\s+(?:and\s+)?(?:a\s+)?half$/i);
    if (mCompound) {
      var w = mCompound[1];
      var baseVal = !isNaN(w) ? parseFloat(w) : (WORD_TO_NUM[w] || 1.0);
      return baseVal + 0.5;
    }

    var mCompoundQ = s.match(/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:and\s+)?(?:a\s+)?quarter$/i);
    if (mCompoundQ) {
      var wq = mCompoundQ[1];
      var baseValQ = !isNaN(wq) ? parseFloat(wq) : (WORD_TO_NUM[wq] || 1.0);
      return baseValQ + 0.25;
    }

    // Slash fractions: "1/2", "3/4"
    if (s.indexOf('/') !== -1) {
      var parts = s.split('/');
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parseFloat(parts[1]) !== 0) {
        return Math.round((parseFloat(parts[0]) / parseFloat(parts[1])) * 1000) / 1000;
      }
    }

    if (s.indexOf('three quarter') !== -1) return 0.75;
    if (WORD_TO_NUM[s] !== undefined) return WORD_TO_NUM[s];

    var num = parseFloat(s);
    return isNaN(num) ? 1.0 : num;
  }

  function cleanName(raw) {
    if (!raw) return '';
    return raw
      .replace(/^(?:items?\s+list|item\s+list|order\s+list|bill\s+list|and|then|also|item|items|of|for|at)\s+/gi, '')
      .replace(/\s+(?:and|then|also|of|for|at)$/gi, '')
      .replace(/[,;.]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  }

  var UNIT_REGEX_PART = 'kg|kgs|kilogram|kilograms|kilo|kilos|g|gm|gms|gram|grams|litre|litres|liter|liters|ltr|l|ml|millilitre|millilitres|milliliter|milliliters|pcs|piece|pieces|pc|unit|units|dozen|doz|dozens|packet|packets|pkt|box|boxes|bag|bags|bundle|bundles|meter|meters|metre|metres|mtr|ft|feet|foot';
  var QTY_REGEX_PART = '(?:(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|to|too)\\s+(?:and\\s+)?(?:a\\s+)?(?:half|quarter|\\d+\\/\\d+)|(?:a\\s+)?(?:half|quarter)|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';

  function parseOneItemSegment(segment) {
    if (!segment) return null;
    segment = segment.trim();

    // 1. Rate indicator pattern: "10 liters oil at 50 rupees per liter"
    var patRate = new RegExp('^(' + QTY_REGEX_PART + ')\\s*(' + UNIT_REGEX_PART + ')?\\s+(?:of\\s+)?([a-zA-Z][a-zA-Z0-9\\s\\-’\']{0,30}?)\\s+(?:at|costing|for|each|per|\\/)\\s*(?:rs\\.?|rupees?|inr|₹|\\$)?\\s*(\\d+(?:\\.\\d{1,2})?)(?:\\s*(?:rs\\.?|rupees?|inr|₹|\\$)?\\s*(?:per\\s+\\w+|each|\\/.*))?$', 'i');
    var mRate = patRate.exec(segment);
    if (mRate) {
      var qtyVal = parseQuantityVal(mRate[1]);
      var unitVal = mRate[2] ? (UNIT_MAP[mRate[2].toLowerCase()] || 'pcs') : 'pcs';
      var nameVal = cleanName(mRate[3]);
      var rateVal = parseFloat(mRate[4]);
      if (nameVal && !isNaN(rateVal) && rateVal > 0) {
        return {
          name: nameVal,
          qty: qtyVal,
          unit: unitVal,
          price: rateVal,
          total: Math.round(qtyVal * rateVal * 100) / 100,
          explicit_price: true
        };
      }
    }

    // 2. NAME + QTY + UNIT + for/total/worth + TOTAL_PRICE: "sugar 2kg 80 rupees"
    var patNameQtyUnit = new RegExp('^([a-zA-Z][a-zA-Z0-9\\s\\-’\']{0,30}?)\\s+(' + QTY_REGEX_PART + ')\\s*(' + UNIT_REGEX_PART + ')\\s*(?:for|total|worth)?\\s*(?:rs\\.?|rupees?|inr|₹|\\$)?\\s*(\\d+(?:\\.\\d{1,2})?)(?:\\s*(?:rs\\.?|rupees?|inr|₹|\\$))?$', 'i');
    var mNameQtyUnit = patNameQtyUnit.exec(segment);
    if (mNameQtyUnit) {
      var name2 = cleanName(mNameQtyUnit[1]);
      var qty2 = parseQuantityVal(mNameQtyUnit[2]);
      var unit2 = UNIT_MAP[mNameQtyUnit[3].toLowerCase()] || 'pcs';
      var total2 = parseFloat(mNameQtyUnit[4]);
      if (name2 && !isNaN(total2)) {
        return {
          name: name2,
          qty: qty2,
          unit: unit2,
          price: qty2 > 0 ? Math.round((total2 / qty2) * 100) / 100 : total2,
          total: total2,
          explicit_price: true
        };
      }
    }

    // 3. QTY + UNIT + (of)? + NAME + PRICE: "2kg sugar 80 rupees", "1 and half kg wheat 90 rupees"
    var patQtyUnitName = new RegExp('^(' + QTY_REGEX_PART + ')\\s*(' + UNIT_REGEX_PART + ')\\s+(?:of\\s+)?([a-zA-Z][a-zA-Z0-9\\s\\-’\']{0,30}?)\\s*(?:for|total|worth)?\\s*(?:rs\\.?|rupees?|inr|₹|\\$)?\\s*(\\d+(?:\\.\\d{1,2})?)(?:\\s*(?:rs\\.?|rupees?|inr|₹|\\$))?$', 'i');
    var mQtyUnitName = patQtyUnitName.exec(segment);
    if (mQtyUnitName) {
      var qty3 = parseQuantityVal(mQtyUnitName[1]);
      var unit3 = UNIT_MAP[mQtyUnitName[2].toLowerCase()] || 'pcs';
      var name3 = cleanName(mQtyUnitName[3]);
      var total3 = parseFloat(mQtyUnitName[4]);
      if (name3 && !isNaN(total3)) {
        return {
          name: name3,
          qty: qty3,
          unit: unit3,
          price: qty3 > 0 ? Math.round((total3 / qty3) * 100) / 100 : total3,
          total: total3,
          explicit_price: true
        };
      }
    }

    // 4. QTY + NAME + PRICE: "3 notebooks 120 rupees"
    var patQtyName = new RegExp('^(' + QTY_REGEX_PART + ')\\s+([a-zA-Z][a-zA-Z0-9\\s\\-’\']{0,30}?)\\s*(?:for|total|worth)?\\s*(?:rs\\.?|rupees?|inr|₹|\\$)?\\s*(\\d+(?:\\.\\d{1,2})?)(?:\\s*(?:rs\\.?|rupees?|inr|₹|\\$))?$', 'i');
    var mQtyName = patQtyName.exec(segment);
    if (mQtyName) {
      var qty4 = parseQuantityVal(mQtyName[1]);
      var name4 = cleanName(mQtyName[2]);
      var total4 = parseFloat(mQtyName[3]);
      if (name4 && !isNaN(total4)) {
        return {
          name: name4,
          qty: qty4,
          unit: 'pcs',
          price: qty4 > 0 ? Math.round((total4 / qty4) * 100) / 100 : total4,
          total: total4,
          explicit_price: true
        };
      }
    }

    return null;
  }

  function extractSequentialStream(text) {
    var items = [];
    if (!text) return items;

    // Pattern 1: NAME QTY UNIT PRICE
    var regex1 = new RegExp('([a-zA-Z][a-zA-Z0-9\\s\\-’\']{1,25}?)\\s+(' + QTY_REGEX_PART + ')\\s*(' + UNIT_REGEX_PART + ')\\s*(?:for|at|costing)?\\s*(?:rs\\.?|rupees?|inr|₹|\\$)?\\s*(\\d+(?:\\.\\d{1,2})?)(?:\\s*(?:rs\\.?|rupees?|inr|₹|\\$))?', 'gi');
    var match1;
    var matches1 = [];
    while ((match1 = regex1.exec(text)) !== null) {
      var n1 = cleanName(match1[1]);
      var q1 = parseQuantityVal(match1[2]);
      var u1 = UNIT_MAP[match1[3].toLowerCase()] || 'pcs';
      var t1 = parseFloat(match1[4]);
      if (n1 && !isNaN(t1)) {
        matches1.push({
          name: n1,
          qty: q1,
          unit: u1,
          price: q1 > 0 ? Math.round((t1 / q1) * 100) / 100 : t1,
          total: t1,
          explicit_price: true
        });
      }
    }

    // Pattern 2: QTY UNIT NAME PRICE
    var regex2 = new RegExp('(' + QTY_REGEX_PART + ')\\s*(' + UNIT_REGEX_PART + ')\\s+(?:of\\s+)?([a-zA-Z][a-zA-Z0-9\\s\\-’\']{1,25}?)\\s*(?:for|at|costing)?\\s*(?:rs\\.?|rupees?|inr|₹|\\$)?\\s*(\\d+(?:\\.\\d{1,2})?)(?:\\s*(?:rs\\.?|rupees?|inr|₹|\\$))?', 'gi');
    var match2;
    var matches2 = [];
    while ((match2 = regex2.exec(text)) !== null) {
      var q2 = parseQuantityVal(match2[1]);
      var u2 = UNIT_MAP[match2[2].toLowerCase()] || 'pcs';
      var n2 = cleanName(match2[3]);
      var t2 = parseFloat(match2[4]);
      if (n2 && !isNaN(t2)) {
        matches2.push({
          name: n2,
          qty: q2,
          unit: u2,
          price: q2 > 0 ? Math.round((t2 / q2) * 100) / 100 : t2,
          total: t2,
          explicit_price: true
        });
      }
    }

    return matches1.length >= matches2.length && matches1.length > 0 ? matches1 : matches2;
  }

  function extractSalesCustomer(text) {
    if (!text) return { text: '', customer: null };
    var clean = text.trim();
    var customer = null;

    // 1. Trailing explicit: 'sold to <Name>', 'sold by <Name>', 'customer <Name>'
    var mExp = clean.match(/\b(?:sold\s+to|sold\s+by|sale\s+to|bought\s+by|given\s+to|customer\s+(?:name\s+)?(?:is\s+)?)\s+([a-zA-Z][a-zA-Z\s]{0,25}?)\s*$/i);
    if (mExp) {
      var rawName = mExp[1].trim();
      var cname = cleanName(rawName);
      if (cname && !UNIT_MAP[cname.toLowerCase()] && WORD_TO_NUM[cname.toLowerCase()] === undefined) {
        customer = cname;
        clean = clean.substring(0, mExp.index).trim();
        return { text: clean, customer: customer };
      }
    }

    // 2. Trailing 'to <Name>' or 'by <Name>' or 'for <Name>'
    var mPrep = clean.match(/\b(?:to|for|by)\s+([a-zA-Z][a-zA-Z]{1,20})\s*$/i);
    if (mPrep) {
      var pName = cleanName(mPrep[1]);
      var stopWords = { each: 1, per: 1, all: 1, rupees: 1, rs: 1, inr: 1, cash: 1, today: 1, now: 1, kg: 1, liter: 1, litre: 1, pcs: 1, gm: 1, g: 1, ml: 1, box: 1, packet: 1, bag: 1, meter: 1, ft: 1 };
      if (pName && !stopWords[pName.toLowerCase()] && !UNIT_MAP[pName.toLowerCase()] && WORD_TO_NUM[pName.toLowerCase()] === undefined) {
        customer = pName;
        clean = clean.substring(0, mPrep.index).trim();
        return { text: clean, customer: customer };
      }
    }

    // 3. Leading 'sold to <Name>'
    var mLead = clean.match(/^\s*(?:sold\s+to|sold\s+by|sale\s+to|given\s+to|customer\s+(?:name\s+)?(?:is\s+)?)\s+([a-zA-Z][a-zA-Z\s]{0,25}?)\s*[:\-,]\s*/i);
    if (mLead) {
      var lName = cleanName(mLead[1]);
      if (lName && !UNIT_MAP[lName.toLowerCase()]) {
        customer = lName;
        clean = clean.substring(mLead[0].length).trim();
        return { text: clean, customer: customer };
      }
    }

    return { text: clean, customer: null };
  }

  return {
    parseQuantity: parseQuantityVal,
    extractCustomer: extractSalesCustomer,

    parseItemsList: function(text) {
      if (!text) return null;
      var trimmed = text.trim();

      // Check trigger or items pattern
      var isTriggered = /^\s*(?:items?\s+list|item\s+list|order\s+list|bill\s+list|list\s+of\s+items?)\b/i.test(trimmed);
      var cleaned = trimmed.replace(/^\s*(?:items?\s+list|item\s+list|order\s+list|bill\s+list|list\s+of\s+items?)\s*[:\-,]?\s*/i, '');
      
      // Extract customer clause (e.g. 'sold to Rahul')
      var custRes = extractSalesCustomer(cleaned);
      cleaned = custRes.text;
      var extractedCustomer = custRes.customer;

      cleaned = cleaned.replace(/^(?:sold|sell|sale|buying|bought|buy)\s+/i, '').trim();

      // Protect "and" inside compound fractions: "1 and half", "one and a half"
      var qtyAndPattern = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+and\s+(?:a\s+)?(half|quarter|\d+\/\d+)\b/gi;
      var masked = cleaned.replace(qtyAndPattern, function(match) {
        return match.replace(/\s+and\s+/gi, ' __AND__ ');
      });

      var normalized = masked.replace(/\band\b/gi, ',');
      normalized = normalized.replace(/__AND__/g, ' and ');

      var segments = normalized.split(/[,;\n]+/).map(function(s) { return s.trim(); }).filter(Boolean);

      var parsedItems = [];
      segments.forEach(function(seg) {
        var itm = parseOneItemSegment(seg);
        if (itm) parsedItems.push(itm);
      });

      if (parsedItems.length <= 1) {
        var streamItems = extractSequentialStream(cleaned);
        if (streamItems.length > parsedItems.length) {
          parsedItems = streamItems;
        }
      }

      if ((isTriggered || parsedItems.length > 0) && parsedItems.length > 0) {
        return {
          items: parsedItems,
          customer_name: extractedCustomer
        };
      }
      return null;
    },

    enrichWithInventory: function(parsedItems) {
      if (!parsedItems || !parsedItems.length) return [];
      var enriched = [];

      parsedItems.forEach(function(item) {
        var invItem = inventoryService.findByName(item.name);

        var result = {
          name: item.name,
          qty: item.qty || 1,
          unit: item.unit || (invItem ? invItem.unit : 'pcs'),
          price: item.price || 0,
          total: item.total || 0,
          price_source: 'missing',
          not_found: false,
          stock_before: null,
          stock_after: null,
          inventory_unit: null,
          inventory_price: null,
          unit_mismatch: false
        };

        if (invItem) {
          result.inventory_unit = invItem.unit;
          result.inventory_price = invItem.price;
          result.stock_before = invItem.quantity;

          if (!item.unit) result.unit = invItem.unit;

          if (item.explicit_price && item.price > 0) {
            result.price = item.price;
            result.price_source = 'voice';
          } else {
            result.price = invItem.price;
            result.price_source = 'inventory';
          }

          if (result.unit !== invItem.unit) result.unit_mismatch = true;
          result.stock_after = Math.max(0, invItem.quantity - item.qty);
        } else {
          result.not_found = true;
          if (item.explicit_price && item.price > 0) {
            result.price = item.price;
            result.price_source = 'voice';
          } else {
            result.price = 0;
            result.price_source = 'missing';
          }
          if (!item.unit) result.unit = 'pcs';
        }

        result.total = Math.round(result.qty * result.price * 100) / 100;
        enriched.push(result);
      });

      return enriched;
    }
  };
}]);
