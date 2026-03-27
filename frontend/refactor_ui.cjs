const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'src', 'components');

const replacements = [
    // shadows and borders on cards
    { from: /shadow-\[0_8px_30px_rgb\(0,0,0,0\.04\)\] border border-white\/60/g, to: 'shadow-2xl shadow-black/40 border border-white/5' },
    { from: /border border-white\/80/g, to: 'border border-white/10' },

    // icon backgrounds
    { from: /bg-emerald-100 text-emerald-600/g, to: 'bg-emerald-500/10 text-emerald-400' },
    { from: /bg-red-100 text-red-600/g, to: 'bg-red-500/10 text-red-400' },
    { from: /bg-brand\/10 text-indigo-400/g, to: 'bg-indigo-500/10 text-indigo-400' },
    { from: /bg-emerald-50 text-emerald-600/g, to: 'bg-emerald-500/20 text-emerald-400' },
    { from: /bg-blue-50 text-blue-600/g, to: 'bg-blue-500/20 text-blue-400' },
    
    // buttons and inputs
    { from: /bg-slate-900\/60/g, to: 'bg-black/20' },
    { from: /focus:ring-brand\/50/g, to: 'focus:ring-indigo-500/50' },
    { from: /bg-white\/10\/10 hover:bg-red-50/g, to: 'bg-white/5 hover:bg-red-500/10' },

    // vibrant light mode gradients to dark subtle gradients
    { from: /from-indigo-50\/50 to-purple-50\/50/g, to: 'from-indigo-500/5 to-purple-500/5' },
    { from: /from-indigo-50\/40 to-blue-50\/40/g, to: 'from-indigo-500/5 to-blue-500/5' },
    { from: /from-indigo-500\/10 to-purple-500\/10/g, to: 'from-indigo-500/10 to-emerald-500/10' },

    // borders and misc
    { from: /border-slate-300/g, to: 'border-white/10' },
    { from: /bg-slate-50\/50 hover:border-blue-400/g, to: 'bg-white/5 hover:border-indigo-400' },
    
    // Auth Pages specific
    { from: /bg-white\/90/g, to: 'bg-white/5' },
    { from: /text-slate-600/g, to: 'text-slate-400' },
    { from: /text-slate-800/g, to: 'text-slate-100' },
    { from: /text-slate-900/g, to: 'text-slate-100' },
    { from: /bg-slate-50/g, to: 'bg-black/20' },
    { from: /border-slate-200/g, to: 'border-white/10' },
    { from: /hover:bg-slate-50/g, to: 'hover:bg-white/5' }
];

function refactorFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    replacements.forEach(r => {
        content = content.replace(r.from, r.to);
    });

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Refactored ${filePath}`);
}

const filesToRefactor = [
    'Dashboard.jsx',
    'Login.jsx',
    'Register.jsx',
    'ForgotPassword.jsx',
    'ResetPassword.jsx'
];

filesToRefactor.forEach(fileName => {
    refactorFile(path.join(componentsDir, fileName));
});

console.log('Done refactoring UI elements.');
