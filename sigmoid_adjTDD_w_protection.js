function middleware(iob, currenttemp, glucose, profile, autosens, meal, reservoir, clock, pumphistory, preferences, basal_profile, oref2_variables) {

   function round(value, digits) {
        if (! digits) { digits = 0; }
        var scale = Math.pow(10, digits);
        return Math.round(value * scale) / scale; 
    }   
   
//Turn on or off
  var enable_sigmoidTDD = true;

   //  Initialize log variables  
   var log_dyn_enabled = "";
   var log_sigmoid_enabled = "";
   var log_enableDynCR = "";
   var log_myGlucose = "";
   var log_target = "";
   var log_adjustmentFactor = "";
   var log_Average = ""; 
   var log_average_total_data = "";
   var log_tdd_dev = "";
   var log_TDD_sigmoid_adjustment_factor = "";
   var log_TDD_sigmoid_max = "";
   var log_TDD_sigmoid_min = "";
   var log_TDD_sigmoid_interval = "";
   var log_TDD_sigmoid_max_minus_one = "";
   var log_TDD_sigmoid_fix_offset = "";
   var log_TDD_sigmoid_exponent = "";
   var log_tdd_factor = "";
   var log_tdd_factor_strength_slider = "";
   var log_modified_tdd_factor = "";
   var log_minimumRatio = "";
   var log_maximumRatio = "";
   var log_ratioInterval  = "";
   var log_max_minus_one = "";
   var log_deviation = ""; 
   var log_fix_offset = "";
   var log_exponent = "";
   var log_sigmoidFactor = "";
   var log_minmax_sigmoidFactor = "";
   var log_normal_cr = "";
   var log_new_isf = "";
   
   // The Middleware Sigmoid Function will only run if both Dynamic ISF and Sigmoid ISF are OFF and the above variable enable_sigmoidTDD is true
   // Initialize Dynamic Status Variables
    const dyn_enabled = profile.useNewFormula;
    const sigmoid_enabled = profile.sigmoid;
    const enableDynCR = profile.enableDynamicCR;
         log_dyn_enabled = "Log: dyn_enabled: " + dyn_enabled;
         log_sigmoid_enabled = ", Log: sigmoid_enabled: " + sigmoid_enabled;
         log_enableDynCR = ", Log: enableDynCR: " + enableDynCR;
   
//  Initialize function variables
  const myGlucose = glucose[0].glucose;
  const minimumRatio = profile.autosens_min;
  const maximumRatio = profile.autosens_max;
  var exerciseSetting = false;
  const target = profile.min_bg;
   const past2hoursAverage = oref2_variables.past2hoursAverage;
   const average_total_data = oref2_variables.average_total_data;
   const weightedAverage = oref2_variables.weightedAverage;
   const duration = oref2_variables.duration;
   const date = oref2_variables.date;
   const isf = profile.sens;
   const adjustmentFactor = profile.adjustmentFactor;

         //  Log function variables
         log_myGlucose = ", Log: myGlucose: " + myGlucose;
         log_minimumRatio = ", Log: minimumRatio: " + minimumRatio;
         log_maximumRatio = ", Log: maximumRatio: " + maximumRatio;
         log_target = ", Log: target: " + target;
         log_adjustmentFactor = ", Log: adjustmentFactor: " + adjustmentFactor;
         log_past2hoursAverage = ", Log: past2hoursAverage: " + past2hoursAverage; 
         log_average_total_data = ", Log: average_total_data: " + average_total_data;
         log_weightedAverage = ", Log: weightedAverage: " + weightedAverage;
         var log_duration = ", Log: duration: " + duration;
         var log_date = ", Log: date: " + date;
         var log_isf = ", Log: isf: " + isf;
         

// Establish Guards
  if (minimumRatio == maximumRatio) {
     enable_sigmoidTDD = false;
  }
  if (profile.high_temptarget_raises_sensitivity || profile.exercise_mode || oref2_variables.isEnabled) {
    exerciseSetting = true;
  }
  if (target >= 118 && exerciseSetting) {
      enable_sigmoidTDD = false;
  }
    
// Sigmoid Function
   
//Only use when dynISF setting is off and Sigmoid is off and the constant enable_sigmoidTDD = true.
    if (enable_sigmoidTDD && !dyn_enabled && !sigmoid_enabled) { 
   
// DYNISF SIGMOID MODIFICATION #1
// Account for delta in TDD of insulin. Define a TDD Factor using a Sigmoid curve that approximates the TDD delta effect used in the Chris Wilson DynISF approach.
// This TDD delta effect is not linear across BGs and requires a curve to mimic.
// ORIGINAL SIGMOID APPROACH: const tdd_factor = tdd_averages.weightedAverage / tdd_averages.average_total_data;

    // Define TDD deviation variable for use in TDD Sigmoid curve based on current percent change between Daily TDD deviation and 2 Week Deviation 
    // This approach will normalize this variable for any TDD value to ensure a standard TDD Factor sigmoid curve for all users

   const tdd_dev = (weightedAverage / average_total_data - 1) * 10;
    log_tdd_dev = "Log: tdd_dev: " + tdd_dev;

    // Hard-code TDD Factor Sigmoid inputs
    // These inputs have been modeled to create a TDD Factor that, when used in the Sigmoid DynISF function, closely approximates the TDD delta effect for ULTRA-RAPID used in the Chris Wilson (Logarithmic) DynISF approach. 
    // These inputs are not expected to require user change for ultra-rapid insulin; instead the strength of this factor can be modified below using the tdd_factor_strength_slider.
    // To model the effects of any changes to these values, or adjust for RAPID insulin, see: https://docs.google.com/spreadsheets/d/1k4sGaZYf2t-FbfY8rViqvUnARx_Gu5K_869AH2wgg_A/edit?usp=sharing
    const TDD_sigmoid_adjustment_factor = .41;
    const TDD_sigmoid_max = 3.25;
    const TDD_sigmoid_min = .7;
      log_TDD_sigmoid_adjustment_factor = ", Log: TDD_sigmoid_adjustment_factor: " + TDD_sigmoid_adjustment_factor;
      log_TDD_sigmoid_max = ", Log: TDD_sigmoid_max: " + TDD_sigmoid_max;
      log_TDD_sigmoid_min = ", Log: TDD_sigmoid_min: " + TDD_sigmoid_min;
       
    // Define a TDD Factor Sigmoid curve using same method as the DynISF Sigmoid approach below
    const TDD_sigmoid_interval = TDD_sigmoid_max - TDD_sigmoid_min;
    const TDD_sigmoid_max_minus_one = TDD_sigmoid_max - 1;
    const TDD_sigmoid_fix_offset = (Math.log10(1/TDD_sigmoid_max_minus_one - TDD_sigmoid_min / TDD_sigmoid_max_minus_one) / Math.log10(Math.E));
    const TDD_sigmoid_exponent = tdd_dev * TDD_sigmoid_adjustment_factor + TDD_sigmoid_fix_offset;
      log_TDD_sigmoid_interval = ", Log: TDD_sigmoid_interval: " + TDD_sigmoid_interval;
      log_TDD_sigmoid_max_minus_one = ", Log: TDD_sigmoid_max_minus_one: " + TDD_sigmoid_max_minus_one;
      log_TDD_sigmoid_fix_offset = ", Log: TDD_sigmoid_fix_offset: " + TDD_sigmoid_fix_offset;
      log_TDD_sigmoid_exponent = ", Log: TDD_sigmoid_exponent: " + TDD_sigmoid_exponent;
       
    // The TDD Factor sigmoid function
    const tdd_factor = TDD_sigmoid_interval / (1 + Math.exp(-TDD_sigmoid_exponent)) + TDD_sigmoid_min;
       log_tdd_factor = ", Log: tdd_factor: " + tdd_factor;

    // Adjust the stregnth of the TDD Factor; 100% = FULL TDD delta effect similar to Chris Wilson (Logarithmic) DynISF, 50% = half the effect, etc.
    const tdd_factor_strength_slider = 1;
       log_tdd_factor_strength_slider = ", Log: log_tdd_factor_strength_slider: " + tdd_factor_strength_slider;


    // The user adjusted TDD factor based on above % slider
    const modified_tdd_factor = ((tdd_factor - 1) * tdd_factor_strength_slider) + 1;
        log_modified_tdd_factor = ", Log: modified_tdd_factor: " + modified_tdd_factor;


// The Dynamic ISF Sigmoid Code 

      
      const ratioInterval = maximumRatio - minimumRatio;
      var max_minus_one = maximumRatio - 1;

      log_minimumRatio = ", Log: minimumRatio: " + minimumRatio;
      log_maximumRatio  = ", Log: maximumRatio: " + maximumRatio;
      log_ratioInterval  = ", Log: ratioInterval: " + ratioInterval;
      log_max_minus_one  = ", Log: max_minus_one: " + max_minus_one;


      // DYNISF SIGMOID MODIFICATION #2
    // The TDD delta effect in Chris Wilson (Logarithmic) DynISF approach allows ISF to shift when BG is below target BG (unlike the original Sigmoid DynamicISF approach). 
    // The following math applies the new TTD factor to the target BG to this shift.
    // Like the original Sigmoid approach, Profile ISF will be applied at target but only when Daily TDD = 2 Week TDD. 
    // ORIGINAL SIGMOID APPROACH: Blood glucose deviation from set target (the lower BG target) converted to mmol/l to fit current formula. 
    // ORIGINAL SIGMOID APPROACH: const bg_dev = (current_bg - profile.min_bg) * 0.0555;

    const deviation = (myGlucose - (target / modified_tdd_factor)) * 0.0555; 
       log_deviation  = ", Log: deviation: " + deviation;
       
     //Makes sigmoid factor(y) = 1 when BG deviation(x) = 0.
     const fix_offset = (Math.log10(1/max_minus_one-minimumRatio/max_minus_one) / Math.log10(Math.E));
       log_fix_offset  = ", Log: fix_offset: " + fix_offset;
       
     //Exponent used in sigmoid formula
     const exponent = deviation * adjustmentFactor * modified_tdd_factor + fix_offset;
       log_exponent  = ", Log: exponent: " + exponent;
       
     // The sigmoid function
     var sigmoidFactor = ratioInterval / (1 + Math.exp(-exponent)) + minimumRatio;
       log_sigmoidFactor  = ", Log: sigmoidFactor: " + sigmoidFactor;
       
     //Respect min/max ratios
     sigmoidFactor = Math.max(Math.min(maximumRatio, sigmoidFactor), sigmoidFactor, minimumRatio);
       log_minmax_sigmoidFactor  = ", Log: sigmoidFactor post min/max: " + sigmoidFactor;

      // Sets the new ratio
     autosens.ratio = sigmoidFactor;
       
      const normal_cr = profile.carb_ratio;
      log_normal_cr = "Log: normal_cr: " + normal_cr;

        // Dynamic CR. Use only when the setting 'Enable Dyanmic CR' is on in FAX Dynamic Settings
        if (autosens.ratio > 1 && enableDynCR) {
            profile.carb_ratio /= ((autosens.ratio - 1) / 2 + 1);
        } else if (enableDynCR) { profile.carb_ratio /= autosens.ratio; }

        const new_isf = profile.sens/autosens.ratio;
          log_new_isf = ", Log: new_isf: " + new_isf;

       // Use TDD variable to Display additional info in enacted pop-up
       oref2_variables.past2hoursAverage = "" + round(sigmoidFactor,2) + round(past2hoursAverage,2) + round(average_total_data,2) + round(weightedAverage,2);
       var log_TDD_info = ", Log: TDD info pop-up: " + oref2_variables.past2hoursAverage ;

        // Return Log to Test Function Operation
   return "Using Middleware function, the autosens ratio has been adjusted with sigmoid factor using the following data: " + log_past2hoursAverage + log_average_total_data + log_weightedAverage + log_tdd_dev + log_TDD_sigmoid_adjustment_factor + log_TDD_sigmoid_max + log_TDD_sigmoid_min + log_TDD_sigmoid_interval + log_TDD_sigmoid_max_minus_one + log_TDD_sigmoid_fix_offset + log_TDD_sigmoid_exponent + log_tdd_factor + log_tdd_factor_strength_slider + log_modified_tdd_factor + log_myGlucose + log_target + log_isf + log_adjustmentFactor + log_minimumRatio + log_maximumRatio + log_ratioInterval + log_max_minus_one + log_deviation + log_fix_offset + log_exponent + log_sigmoidFactor + log_minmax_sigmoidFactor + log_new_isf + log_autosens_ratio_info;
       
        
        // return "Using Middleware function, the autosens ratio has been adjusted with sigmoid factor to: " + round(autosens.ratio, 2) + ". New ISF = " + round(new_isf, 2) + " mg/dl (" + round(0.0555 * new_isf, 2) + " (mmol/l)" + ". CR adjusted from " + round(normal_cr,2) + " to " + round(profile.carb_ratio,2) + " (" + round(0.0555 * profile.carb_ratio, 2) + " mmol/l).";
    } else { return "Nothing changed"; }
}
