// Test file - all linter errors fixed
function goodFunction() {
  // Fixed: removed unused variables, fixed quotes and semicolons
  const message = 'properly formatted string';
  
  // Fixed: proper spacing in if statement
  if (true) {
    return message;
  }
  
  return 'default';
}

// Fixed: added semicolon
goodFunction();