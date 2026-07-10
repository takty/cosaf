import { defineConfig } from 'vite'

export default defineConfig({
	root : 'src/_docs',
	base : './',
	build: {
		outDir     : '../../docs',
		emptyOutDir: true,
	},
	resolve: {
		tsconfigPaths: true,
	},
});
