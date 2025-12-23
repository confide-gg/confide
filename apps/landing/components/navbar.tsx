"use client";

import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const compareLinks = [
  { label: "vs Discord", href: "/compare/discord" },
];

const navLinks = [
  { label: "Features", href: "/features" },
  { label: "GitHub", href: "https://github.com/confide-gg/confide", external: true },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const compareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (compareRef.current && !compareRef.current.contains(e.target as Node)) {
        setCompareOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, external?: boolean) => {
    if (external) return;
    setMobileMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 select-none">
      <nav
        className={`mx-auto max-w-4xl transition-all duration-500 ${
          scrolled
            ? "bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-lg shadow-black/20"
            : "bg-transparent"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-6">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-primary"
          >
            Confide
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <div ref={compareRef} className="relative">
              <button
                onClick={() => setCompareOpen(!compareOpen)}
                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Compare
                <ChevronDown className={`w-4 h-4 transition-transform ${compareOpen ? "rotate-180" : ""}`} />
              </button>
              {compareOpen && (
                <div className="absolute top-full left-0 mt-2 w-40 py-2 bg-white/10 backdrop-blur-2xl border border-white/10 rounded-xl shadow-xl">
                  {compareLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                      onClick={() => setCompareOpen(false)}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href, link.external)}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:block">
            <Button
              asChild
              size="sm"
              className="h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <a
                href="https://x.com/ConfideChat"
                target="_blank"
                rel="noopener noreferrer"
              >
                Follow on X
              </a>
            </Button>
          </div>

          <button
            className="md:hidden text-foreground p-2 hover:bg-white/10 rounded-xl transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden mt-2 mx-auto max-w-4xl bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4">
            <div className="flex flex-col gap-1">
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Compare
              </div>
              {compareLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground rounded-xl hover:bg-white/5 pl-8"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="h-px bg-white/10 my-2" />
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground rounded-xl hover:bg-white/5"
                  onClick={(e) => handleNavClick(e, link.href, link.external)}
                >
                  {link.label}
                </a>
              ))}
              <Button
                asChild
                size="sm"
                className="mt-3 h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <a
                  href="https://x.com/ConfideChat"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Follow on X
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
