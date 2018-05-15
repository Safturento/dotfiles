from stbar.modules.module import Module

DEFAULT_CONFIG = {
	"Test": {
	}
}

class Test(Module):
	def __init__(self, stbar, parent_bar):
		Module.__init__(self, 'Test', stbar, parent_bar, DEFAULT_CONFIG)

		self.setText('TEST')

def init(stbar, parent_bar): return Test(stbar, parent_bar)