"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "./constants";

export function FAQ() {
  return (
    <section className="min-h-screen py-32">
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="mx-auto max-w-4xl px-4"
      >
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight text-foreground mb-16 text-center">
          <span className="text-foreground">Frequently Asked </span>
          <span
            className="text-primary"
            style={{ textShadow: "0 0 60px rgba(201, 237, 123, 0.4)" }}
          >
            Questions
          </span>
        </h2>

        <Accordion type="single" collapsible className="w-full space-y-3">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border border-white/5 rounded-2xl bg-white/[0.02] backdrop-blur-sm transition-all hover:bg-white/[0.04] data-[state=open]:bg-white/[0.06] data-[state=open]:border-primary/20 data-[state=open]:pb-6"
            >
              <AccordionTrigger className="text-lg font-bold text-foreground hover:text-primary hover:no-underline py-5 px-6">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground leading-relaxed px-6 pb-0">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </section>
  );
}
