export const isLocalhost = () => {
	if (typeof window === "undefined") return true;
	const hostname = window.location.hostname;
	return (
		hostname === "localhost" ||
		hostname === "[::1]" ||
		hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/) !==
			null ||
		hostname.endsWith(".local")
	);
};
