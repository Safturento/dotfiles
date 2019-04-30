local root = os.getenv('HOME')..'/.config/awesome/font-awesome'

return function(folder, code)
	return string.format('%s/%s/%s.svg', root, folder, code)
end