# Test file for hook logging
import os
import sys

def bad_function(x,y):
    z=x+y
    unused_var = 100
    return z

class TestClass:
    def __init__(self):
        self.value=42