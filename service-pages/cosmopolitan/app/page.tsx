"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const marqueeWords = [
  "COMING",
  "SOON",
  "COSMOPOLITAN",
  ".",
  "COMING",
  "SOON",
  "COSMOPOLITAN",
  ".",
  "COMING",
  "SOON",
  "COSMOPOLITAN",
  ".",
  "COMING",
  "SOON",
  "COSMOPOLITAN",
  ".",
];

const buildMarqueeBlinkStyle = (index: number, word: string): CSSProperties => {
  if (word === ".") {
    return {};
  }

  const delay = ((index * 1.37) % 8.6).toFixed(2);
  const duration = (4.8 + ((index * 0.91) % 2.9)).toFixed(2);

  return {
    ["--marquee-delay" as string]: `${delay}s`,
    ["--marquee-duration" as string]: `${duration}s`,
  } as CSSProperties;
};

export default function Home() {
  const teamPageUrl = process.env.NEXT_PUBLIC_TEAM_URL ?? "http://localhost:3000/team";
  const [reachOpen, setReachOpen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;

    if (!dot || !ring) {
      return;
    }

    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;
    let animationFrame = 0;

    const move = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      dot.style.left = `${mouseX}px`;
      dot.style.top = `${mouseY}px`;
    };

    const loop = () => {
      ringX += (mouseX - ringX) * 0.1;
      ringY += (mouseY - ringY) * 0.1;
      ring.style.left = `${ringX}px`;
      ring.style.top = `${ringY}px`;
      animationFrame = window.requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", move);
    animationFrame = window.requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", move);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    const handleMouse = (event: MouseEvent) => {
      setMousePos({
        x: (event.clientX / window.innerWidth - 0.5) * 2,
        y: (event.clientY / window.innerHeight - 0.5) * 2,
      });
    };

    window.addEventListener("mousemove", handleMouse);

    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  return (
    <main className="shell">
      <div ref={dotRef} className="cursorDot" aria-hidden="true" />
      <div ref={ringRef} className="cursorRing" aria-hidden="true" />

      <div
        className="videoWrap"
        style={{
          transform: `translate(${mousePos.x * -6}px, ${mousePos.y * -6}px) scale(1.015)`,
        }}
      >
        <video
          className="bgVideo"
          src="/cosmopolitan-bg.mp4"
          poster="/cosmopolitan-poster.jpeg"
          autoPlay
          loop
          muted
          playsInline
        />
      </div>
      <div className="videoGrad" />
      <div className="grain" />

      <header className="header">
        <div className="headerLeft">
          <img src="/logo.png" alt="TIB" className="logo" />
        </div>
        <nav className="headerNav">
          <span>Est. 2026</span>
          <span className="navDivider">|</span>
          <span>Executive Class</span>
          <span className="navDivider">|</span>
          <span>India</span>
        </nav>
        <div className="headerRight">
          <a href={teamPageUrl} className="headerLink">
            Team
          </a>
        </div>
      </header>

      <div className="sideLeft">
        <span>Cosmopolitan.tib</span>
      </div>
      <div className="sideRight">
        <span>Corporate Parties</span>
      </div>

      <section className="hero">
        <div className="heroGrid">
          <div className="heroColLeft">
            <div className="indexBadge">
              <span className="indexNum">03</span>
              <span className="indexLabel">Cosmopolitan</span>
            </div>
            <div className="heroCopy">
              <p>
                Corporate cocktail moments,
                <br />
                reimagined for India&apos;s
                <br />
                modern executive hosts.
              </p>
            </div>
            <div className="heroMeta">
              <div className="metaItem">
                <span className="metaKey">Service</span>
                <span className="metaVal">Corporate Hosting</span>
              </div>
              <div className="metaItem">
                <span className="metaKey">Access</span>
                <span className="metaVal">Executive Curation</span>
              </div>
              <div className="metaItem">
                <span className="metaKey">Status</span>
                <span className="metaVal accentText">Coming Soon</span>
              </div>
            </div>
          </div>

          <div className="heroColCentre">
            <div className="titleBlock">
              <span className="titleEye">Corporate Parties by</span>
              <div className="titleWrap">
                <h1 className="titleMain">
                  <span className="titleWord">Cosmopolitan</span>
                  <span className="titleSuffix">.tib</span>
                </h1>
              </div>
            </div>
          </div>

          <div className="heroColRight">
            <div className="serviceSeal">
              <div className="sealHex">
                  <span>CO</span>
              </div>
              <p className="sealLabel">
                the
                <br />
                indian
                <br />
                bar
              </p>
            </div>

            <div className="reachPanel">
              <button
                type="button"
                className="reachBtn"
                onClick={() => setReachOpen((value) => !value)}
              >
                <span>Reach Us</span>
                <svg
                  className={`chevron ${reachOpen ? "open" : ""}`}
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  aria-hidden="true"
                >
                  <path
                    d="M1.5 3.5 5 7 8.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </button>
              <div className={`reachOptions ${reachOpen ? "open" : ""}`}>
                <a href="mailto:support@theindianbarcompany.com">Email</a>
                <a href="tel:+917896830724">Call</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="marqueeStrip">
        <div className="marqueeTrack">
          {[...marqueeWords, ...marqueeWords].map((word, index) => (
            <span
              key={`${word}-${index}`}
              className={`marqueeWord ${word === "." ? "marqueeDot" : ""}`}
              style={buildMarqueeBlinkStyle(index, word)}
            >
              {word}
            </span>
          ))}
        </div>
      </div>

      <footer className="footer">
        <span className="footerLeft">Copyright 2026 The Indian Bar Company</span>
        <span className="footerCentre">Grinding social spice to your corporate</span>
        <span className="footerRight">cosmopolitan.tib</span>
      </footer>
    </main>
  );
}
