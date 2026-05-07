import Script from "next/script";

export const ThemeInitScript = () => (
	<Script id="theme-init" strategy="beforeInteractive">
		{`
      try {
        const theme = localStorage.getItem('theme');
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {}
    `}
	</Script>
);
