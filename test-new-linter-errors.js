// Test file with fixed linter errors
function goodFunction() {
  const properly_used_var = 'should use const/let';
  console.log('fixed semicolon and quotes:', properly_used_var);
  
  if (true) {
    console.log('fixed spacing and semicolon');
  }
  
  return 'fixed extra spaces';
}

// Fixed semicolon
goodFunction();