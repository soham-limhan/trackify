const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src', 'components', 'Dashboard.jsx');

if (fs.existsSync(targetFile)) {
    let content = fs.readFileSync(targetFile, 'utf8');

    // Add import statement for framer-motion if not present
    if (!content.includes("import { motion }")) {
        content = content.replace("import React,", "import React, {");
        content = content.replace("import { useNavigate }", "import { useNavigate }\nimport { motion } from 'framer-motion';");
    }

    // Wrap the top-level main tag
    content = content.replace(
        /<main ref=\{dashboardRef\} className="max-w-7xl/g, 
        '<motion.main initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, staggerChildren: 0.1 }} ref={dashboardRef} className="max-w-7xl'
    );
    content = content.replace(/<\/main>/g, '</motion.main>');

    // Replace the specific summary cards grid wrapper
    content = content.replace(
        /<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 relative z-20">/g,
        '<motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 relative z-20">'
    );
    // Note: since we only changed the opening tag to motion.div, we need to match the closing tag. But it's risky via regex.
    // So we'll also replace the children cards to be motion.div
    content = content.replace(
        /<div className="glass rounded-3xl p-6 hover:-translate-y-1 transition-transform">/g, 
        '<motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="glass rounded-3xl p-6">'
    );

    // Save
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log("Successfully added framer-motion to Dashboard.jsx");
} else {
    console.log("Dashboard.jsx not found.");
}
