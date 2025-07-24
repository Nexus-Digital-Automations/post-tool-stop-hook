
def poorly_formatted_function(x, y):
    z = x + y  # Fixed spaces around operators
    return z

class TestClass:
    def __init__(self):
        self.value=10
        
    def method_with_issues(self):
        list = [1,2,3]  # Using builtin name
        for i in range(len(list)):  # Should use enumerate
            print(list[i])