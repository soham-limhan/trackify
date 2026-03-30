const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'src', 'components');

const replacements = [
    // shadows and borders
    { from: /shadow-2xl shadow-black\/40/g, to: 'shadow-xl shadow-slate-200/50' },
    { from: /border border-white\/5/g, to: 'border border-slate-200' },
    { from: /border border-white\/10/g, to: 'border border-slate-200' },
    { from: /border-white\/20/g, to: 'border-slate-200' },
    { from: /border-white\/30/g, to: 'border-slate-300' },
    { from: /shadow-black\/20/g, to: 'shadow-slate-200/50' },
    { from: /shadow-[a-z]+-500\/30/g, to: 'shadow-sm' },

    // text colors
    { from: /text-white\/90/g, to: 'text-slate-800' },
    { from: /text-white\/70/g, to: 'text-slate-600' },
    { from: /text-white\/60/g, to: 'text-slate-500' },
    { from: /text-white\/50/g, to: 'text-slate-500' },
    { from: /text-white\/40/g, to: 'text-slate-400' },
    { from: /text-white\/10/g, to: 'text-slate-200' },
    { from: /text-slate-100/g, to: 'text-slate-800' },
    { from: /text-white/g, to: 'text-slate-900' },
    { from: /text-slate-300/g, to: 'text-slate-600' },
    { from: /text-slate-400/g, to: 'text-slate-500' },

    // backgrounds
    { from: /bg-black\/20/g, to: 'bg-white border border-slate-200' },
    { from: /bg-white\/5/g, to: 'bg-white/80' },
    { from: /bg-white\/10\/5/g, to: 'bg-slate-100/50' },
    { from: /bg-white\/10/g, to: 'bg-slate-50' },
    
    // icons and accents
    { from: /bg-emerald-500\/10/g, to: 'bg-emerald-100' },
    { from: /bg-emerald-500\/20/g, to: 'bg-emerald-100' },
    { from: /text-emerald-400/g, to: 'text-emerald-600' },
    { from: /bg-red-500\/10/g, to: 'bg-red-100' },
    { from: /text-red-400/g, to: 'text-red-600' },
    { from: /bg-indigo-500\/10/g, to: 'bg-indigo-100' },
    { from: /text-indigo-400/g, to: 'text-indigo-600' },
    { from: /bg-blue-500\/20/g, to: 'bg-blue-100' },
    { from: /text-blue-400/g, to: 'text-blue-600' },
    { from: /bg-amber-500\/10/g, to: 'bg-amber-100' },
    
    // interactions and gradients
    { from: /focus:ring-indigo-500\/50/g, to: 'focus:ring-indigo-500/30' },
    { from: /focus:ring-purple-500\/50/g, to: 'focus:ring-purple-500/30' },
    { from: /hover:bg-red-500\/10/g, to: 'hover:bg-red-50' },
    { from: /from-indigo-500\/5 to-purple-500\/5/g, to: 'from-indigo-50/50 to-purple-50/50' },
    { from: /from-indigo-500\/10 to-emerald-500\/10/g, to: 'from-indigo-50/80 to-emerald-50/80' },
    { from: /from-white via-indigo-100 to-white/g, to: 'from-slate-900 via-indigo-800 to-slate-900' },
    { from: /bg-brand/g, to: 'bg-indigo-600' }
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

console.log('Done refactoring UI elements to light theme.');
