// Shared by about.html, contact.html and the district pages (dist/d*.html).
// index.html has its own navbar/menu logic and does not load this file.
history.scrollRestoration = 'manual';

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const triggerElement = document.getElementById('nav-anchor-trigger');

    // Mobile menu toggle
    if (mobileMenuToggle && navbar) {
        mobileMenuToggle.addEventListener('click', () => {
            navbar.classList.toggle('nav-open');
            document.body.classList.toggle('noscroll');
            document.documentElement.classList.toggle('noscroll');

            const isExpanded = navbar.classList.contains('nav-open');
            mobileMenuToggle.setAttribute('aria-expanded', isExpanded);

            const icon = mobileMenuToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars', !isExpanded);
                icon.classList.toggle('fa-times', isExpanded);
            }
        });
    }

    // Anchor the navbar once #nav-anchor-trigger (placed right after <header>) scrolls off the top
    if (navbar && triggerElement) {
        const navHeight = navbar.offsetHeight;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // Padding on body stops content jumping when the navbar leaves the flow
                if (!entry.isIntersecting) {
                    navbar.classList.add('navbar--anchored');
                    document.body.style.paddingTop = navHeight + 'px';
                } else {
                    navbar.classList.remove('navbar--anchored');
                    document.body.style.paddingTop = '0';
                }
            });
        }, { rootMargin: '-1px 0px 0px 0px' });
        observer.observe(triggerElement);
    }

    // Footer headings animate while the pointer is over their link list
    document.querySelectorAll('.footer-column').forEach(column => {
        const heading = column.querySelector('h4');
        const list = column.querySelector('ul');
        if (heading && list) {
            list.addEventListener('mouseenter', () => heading.classList.add('is-active'));
            list.addEventListener('mouseleave', () => heading.classList.remove('is-active'));
        }
    });
});
