function middleware(iob, temp_basal, glucose, profile, autosens, meal, reservoir, preferences, basal_profile, oref2_variables) {

   function round(value, digits) {
        if (! digits) { digits = 0; }
        var scale = Math.pow(10, digits);
        return Math.round(value * scale) / scale; 
    }   
    
//Turn on or off
  var enable_sigmoidTDD = true;
 
// The Middleware Sigmoid Function will only run if both Dynamic ISF and Sigmoid ISF are OFF and the above variable enable_sigmoidTDD is true
    const dyn_enabled = profile.useNewFormula;
    const sigmoid_enabled = profile.sigmoid;
    const enableDynCR = profile.enableDynamicCR;

  const myGlucose = glucose[0].glucose;
  const minimumRatio = profile.autosens_min;
  const maximumRatio = profile.autosens_max;
  var exerciseSetting = false;
  const target = profile.min_bg;
  const adjustmentFactor = profile.adjustmentFactor;
  
  // Guards
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
    const tdd_dev = (oref2_variables.weightedAverage / oref2_variables.average_total_data - 1) * 10;

    // Hard-code TDD Factor Sigmoid inputs
    // These inputs have been modeled to create a TDD Factor that, when used in the Sigmoid DynISF function, closely approximates the TDD delta effect for ULTRA-RAPID used in the Chris Wilson (Logarithmic) DynISF approach. 
    // These inputs are not expected to require user change for ultra-rapid insulin; instead the strength of this factor can be modified below using the tdd_factor_strength_slider.
    // To model the effects of any changes to these values, or adjust for RAPID insulin, see: https://docs.google.com/spreadsheets/d/1k4sGaZYf2t-FbfY8rViqvUnARx_Gu5K_869AH2wgg_A/edit?usp=sharing
    const TDD_sigmoid_adjustment_factor = .42;
    const TDD_sigmoid_max = 4;
    const TDD_sigmoid_min = .7;

    // Define a TDD Factor Sigmoid curve using same method as the DynISF Sigmoid approach below
    const TDD_sigmoid_interval = TDD_sigmoid_max - TDD_sigmoid_min;
    const TDD_sigmoid_max_minus_one = TDD_sigmoid_max - 1;
    const TDD_sigmoid_fix_offset = (Math.log10(1/TDD_sigmoid_max_minus_one - TDD_sigmoid_min / TDD_sigmoid_max_minus_one) / Math.log10(Math.E));
    const TDD_sigmoid_exponent = tdd_dev * TDD_sigmoid_adjustment_factor + fix_offset;
    
    // The TDD Factor sigmoid function
    const tdd_factor = TDD_sigmoid_interval / (1 + Math.exp(-TDD_sigmoid_exponent)) + TDD_sigmoid_min;

    // Adjust the stregnth of the TDD Factor; 100% = FULL TDD delta effect similar to Chris Wilson (Logarithmic) DynISF, 50% = half the effect, etc.
    const tdd_factor_strength_slider = 1;

    // The user adjusted TDD factor based on above % slider
    const modified_tdd_factor = ((tdd_factor - 1) * tdd_factor_strength_slider) + 1;


// The Dynamic ISF Sigmoid Code 

   if (enable_sigmoidTDD) {  
      const minimumRatio = profile.autosens_min;
      const maximumRatio = profile.autosens_max;
      const ratioInterval = maximumRatio - minimumRatio;
       var max_minus_one = maximumRatio - 1;

      // DYNISF SIGMOID MODIFICATION #2
    // The TDD delta effect in Chris Wilson (Logarithmic) DynISF approach allows ISF to shift when BG is below target BG (unlike the original Sigmoid DynamicISF approach). 
    // The following math applies the new TTD factor to the target BG to this shift.
    // Like the original Sigmoid approach, Profile ISF will be applied at target but only when Daily TDD = 2 Week TDD. 
    // ORIGINAL SIGMOID APPROACH: Blood glucose deviation from set target (the lower BG target) converted to mmol/l to fit current formula. 
    // ORIGINAL SIGMOID APPROACH: const bg_dev = (current_bg - profile.min_bg) * 0.0555;

    const deviation = (myGlucose - (target / modified_tdd_factor)) * 0.0555; 
       
     //Makes sigmoid factor(y) = 1 when BG deviation(x) = 0.
     const fix_offset = (Math.log10(1/max_minus_one-minimumRatio/max_minus_one) / Math.log10(Math.E));
       
     //Exponent used in sigmoid formula
     const exponent = deviation * adjustment_factor * modified_tdd_factor + fix_offset;
       
     // The sigmoid function
     var sigmoidFactor = ratioInterval / (1 + Math.exp(-exponent)) + minimumRatio;
       
     //Respect min/max ratios
     sigmoidFactor = Math.max(Math.min(maximumRatio, sigmoidFactor), sigmoidFactor, minimumRatio);

      // Sets the new ratio
     autosens.ratio = sigmoidFactor;
       
    const normal_cr = profile.carb_ratio;

        // Dynamic CR. Use only when the setting 'Enable Dyanmic CR' is on in FAX Dynamic Settings
        if (autosens.ratio > 1 && enableDynCR) {
            profile.carb_ratio /= ((autosens.ratio - 1) / 2 + 1);
        } else if (enableDynCR) { profile.carb_ratio /= autosens.ratio; }

        const new_isf = profile.sens/autosens.ratio;
        
        return "Using Middleware function, the autosens ratio has been adjusted with sigmoid factor to: " + round(autosens.ratio, 2) + ". New ISF = " + round(new_isf, 2) + " mg/dl (" + round(0.0555 * new_isf, 2) + " (mmol/l)" + ". CR adjusted from " + round(normal_cr,2) + " to " + round(profile.carb_ratio,2) + " (" + round(0.0555 * profile.carb_ratio, 2) + " mmol/l).";
    } else { return "Nothing changed"; }
}
