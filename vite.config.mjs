import { defineConfig } from 'vite';
export default defineConfig({root:'mobile-app',base:'./',build:{outDir:'../dist/mobile',emptyOutDir:true},server:{port:5173,proxy:{'/api':'http://localhost:3000'}}});
