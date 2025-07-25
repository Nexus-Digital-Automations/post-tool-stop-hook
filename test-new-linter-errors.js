// Test file with intentional linter errors to trigger hook
const unused_var = "this should trigger no-unused-vars";

function badFunction() {
  var old_style = "should use const/let"
  console.log("missing semicolon")
  
  if(true){
    console.log("bad spacing")
  }
  
  return    "extra spaces";
}

// Missing semicolon
badFunction()