const updateProjectSettingsRoute = () => {
  const fs = require('fs');
  const routerPath = '/Users/felix/web/git/repo-md/pushmd-app/src/router.js';
  
  let content = fs.readFileSync(routerPath, 'utf8');
  
  // Using regex to find and replace the ProjectSettings route
  const pattern = /(path:\s*["']settings["'],\s*name:\s*["']ProjectSettings["'],\s*component:\s*\(\)\s*=>\s*import\(["']@\/view\/ProjectSettings\.vue["']\),)/;
  const replacement = 'path: "settings/:section?",\n\t\t\t\t\tname: "ProjectSettings",\n\t\t\t\t\tcomponent: () => import("@/view/ProjectSettings.vue"),';
  
  content = content.replace(pattern, replacement);
  
  fs.writeFileSync(routerPath, content, 'utf8');
  console.log('Updated ProjectSettings route with section parameter');
};

updateProjectSettingsRoute();
