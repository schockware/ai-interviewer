// Builds clean, single-column DOCX resumes and job descriptions.
// Usage: node make_docx.js <input.json>
// Input: array of { resume_out, jd_out, resume: {...}, jd: {...} } (see build_documents.py)
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, BorderStyle,
} = require("docx");

const FONT = "Arial";
const BODY = 21; // half-points: 10.5 pt

const styles = {
  default: { document: { run: { font: FONT, size: BODY } } },
  paragraphStyles: [
    {
      id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 40, bold: true, font: FONT },
      paragraph: { spacing: { before: 0, after: 60 } },
    },
    {
      id: "Heading1", name: "heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 24, bold: true, font: FONT, allCaps: true },
      paragraph: {
        spacing: { before: 240, after: 80 }, outlineLevel: 0,
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "777777", space: 2 } },
      },
    },
    {
      id: "Heading2", name: "heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 22, bold: true, font: FONT },
      paragraph: { spacing: { before: 160, after: 20 }, outlineLevel: 1, keepNext: true },
    },
  ],
};

const numbering = {
  config: [{
    reference: "bullets",
    levels: [{
      level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 540, hanging: 270 } } },
    }],
  }],
};

const p = (text, opts = {}) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 60 }, ...opts });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const title = (t) => new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(t)] });
const bullet = (t) => new Paragraph({
  numbering: { reference: "bullets", level: 0 }, children: [new TextRun(t)], spacing: { after: 40 },
});

function resumeChildren(r) {
  const c = [title(r.name), p(r.contact_line), h1("Summary"), p(r.summary), h1("Experience")];
  for (const j of r.jobs) {
    c.push(h2(`${j.title}, ${j.employer}`), p(`${j.location} | ${j.dates}`, { spacing: { after: 40 } }));
    j.bullets.forEach((b) => c.push(bullet(b)));
  }
  c.push(h1("Education"), ...r.education.map(bullet), h1("Skills"), p(r.skills.join(", ")));
  if (r.certifications.length) c.push(h1("Certifications"), ...r.certifications.map(bullet));
  return c;
}

function jdChildren(j) {
  return [
    title(j.role), p(`${j.company} | ${j.location}`),
    h1("About us"), p(j.about),
    h1("What you'll do"), ...j.duties.map(bullet),
    h1("What we're looking for"), ...j.requirements.map(bullet),
    p(`${j.company} is an equal opportunity employer.`, { spacing: { before: 200, after: 0 } }),
  ];
}

function makeDoc(titleText, children) {
  return new Document({
    creator: "Synthetic test persona",
    title: titleText,
    description: "Fictional document for software testing",
    styles, numbering,
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1260, right: 1260 } } },
      children,
    }],
  });
}

(async () => {
  const items = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  let n = 0;
  for (const it of items) {
    fs.writeFileSync(it.resume_out, await Packer.toBuffer(makeDoc(`${it.resume.name} - Resume`, resumeChildren(it.resume))));
    fs.writeFileSync(it.jd_out, await Packer.toBuffer(makeDoc(`${it.jd.role} - ${it.jd.company}`, jdChildren(it.jd))));
    n += 2;
  }
  console.log(`docx: wrote ${n} files`);
})();
