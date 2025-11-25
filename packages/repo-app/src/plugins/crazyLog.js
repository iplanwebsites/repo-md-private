// src/utils/styledConsoleLog.js

import envizion from "envizion";

export function logStyledMessage() {
	envizion({
		subtitle: "work with us!",
		title: "Repo.md",
	});

	/*
	const MSG = " Repo.md  ";
	const sub = "  ";
	console.groupCollapsed("%c" + MSG + " %c  " + sub, cssCrazy, "color:black; ");

	//console.info("work with us: ", "team@aura.town");
	//onsole.info("build something: ", "https://aura.town");
	console.info(" -- ");
	console.info(
		"Version ",
		import.meta.env.VITE_APP_VERSION,
		import.meta.env.MODE,
	);
	console.info(
		new Date(import.meta.env.VITE_APP_BUILD_DATE).toLocaleDateString(),
	);

	console.groupEnd();
	*/
}
