"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const marqueeWords = [
  "COMING",
  "SOON",
  "MARTINI",
  ".",
  "COMING",
  "SOON",
  "MARTINI",
  ".",
  "COMING",
  "SOON",
  "MARTINI",
  ".",
  "COMING",
  "SOON",
  "MARTINI",
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
          src="/martini-bg.mp4"
          poster="/martini-poster.jpeg"
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
          <span>Private Hospitality</span>
          <span className="navDivider">|</span>
          <span>India</span>
        </nav>
        <div className="headerRight">
          <a href="mailto:support@theindianbarcompany.com" className="headerLink">
            Contact
          </a>
        </div>
      </header>

      <div className="sideLeft">
        <span>Martini.tib</span>
      </div>
      <div className="sideRight">
        <span>House Parties</span>
      </div>

      <section className="hero">
        <div className="heroGrid">
          <div className="heroColLeft">
            <div className="indexBadge">
              <span className="indexNum">01</span>
              <span className="indexLabel">Martini</span>
            </div>
            <div className="heroCopy">
              <p>
                Luxury house parties,
                <br />
                reimagined for India&apos;s
                <br />
                most discerning hosts.
              </p>
            </div>
            <div className="heroMeta">
              <div className="metaItem">
                <span className="metaKey">Service</span>
                <span className="metaVal">Private Hosting</span>
              </div>
              <div className="metaItem">
                <span className="metaKey">Access</span>
                <span className="metaVal">By Invite Only</span>
              </div>
              <div className="metaItem">
                <span className="metaKey">Status</span>
                <span className="metaVal accentText">Coming Soon</span>
              </div>
            </div>
          </div>

          <div className="heroColCentre">
            <div className="titleBlock">
              <span className="titleEye">House Parties by</span>
              <div className="titleWrap">
                <h1 className="titleMain">
                  <span className="titleWord">Martini</span>
                  <span className="titleSuffix">.tib</span>
                </h1>
              </div>
            </div>
          </div>

          <div className="heroColRight">
            <div className="serviceSeal">
              <div className="sealHex">
                <span>MT</span>
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
        <span className="footerCentre">Grinding social spice at your door step</span>
        <span className="footerRight">martini.tib</span>
      </footer>
    </main>
  );
}
