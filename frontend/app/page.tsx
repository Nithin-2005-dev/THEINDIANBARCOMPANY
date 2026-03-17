"use client";

export default function Home() {
  return (
    <main className="container">
      <div className="content">
        {/* Logo */}
        <img
          src="/logo.jpeg"
          alt="The Indian Bar"
          className="logo"
        />

        {/* Brand Name */}
        <h1 className="brand">
          the<span>indian</span>bar
        </h1>

        {/* Tagline */}
        <p className="tagline">
          your dream weekend is our weekday.
        </p>

        {/* Status */}
        <p className="status">Coming Soon</p>

        {/* Contact */}
        <div className="contact">

          {/* Email */}
          <a href="mailto:support@theindianbarcompany.com">
            support@theindianbarcompany.com
          </a>

          {/* WhatsApp */}
          <a
            href="https://wa.me/917896830724"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp: +91 78968 30724
          </a>

          {/* Instagram */}
          <a
            href="https://www.instagram.com/theindianbarcompany/?hl=en"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram @theindianbarcompany
          </a>

        </div>
      </div>

      <footer className="footer">
        © {new Date().getFullYear()} The Indian Bar Company
      </footer>
    </main>
  );
}