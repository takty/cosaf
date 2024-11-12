import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
	root : 'src/_docs',
	base : './',
	build: {
		outDir     : '../../docs',
		emptyOutDir: true,
	},
	plugins: [tsconfigPaths()],
});
