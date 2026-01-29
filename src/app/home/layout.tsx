import Script from "next/script";
import type { PropsWithChildren } from "react";

const HomeLayout = ({ children }: Readonly<PropsWithChildren>) => {
	return (
		<>
			<Script id="force-light-mode-home" strategy="beforeInteractive">
				{`
					(function() {
						// Force light mode on /home page
						try {
							document.documentElement.classList.remove('dark');
							
							// Override localStorage for this page only
							const originalSetItem = localStorage.setItem.bind(localStorage);
							localStorage.setItem = function(key, value) {
								if (key === 'theme' && window.location.pathname === '/home') {
									// Prevent setting theme on /home page
									return;
								}
								return originalSetItem(key, value);
							};
							
							// Continuously enforce light mode
							const observer = new MutationObserver(function() {
								if (window.location.pathname === '/home') {
									document.documentElement.classList.remove('dark');
								}
							});
							
							observer.observe(document.documentElement, {
								attributes: true,
								attributeFilter: ['class']
							});
						} catch (e) {
							console.error('Failed to force light mode:', e);
						}
					})();
				`}
			</Script>
			<div className="light">{children}</div>
		</>
	);
};

export default HomeLayout;
