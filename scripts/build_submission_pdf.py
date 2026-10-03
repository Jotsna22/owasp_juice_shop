#!/usr/bin/env python3
"""Build the HW 2B submission PDF from the lab screenshots."""

from pathlib import Path

from PIL import Image
from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "docs" / "screenshots"
OUT = ROOT / "submission" / "HW2B-Juice-Shop.pdf"

PART_1 = """\
Juice Shop has three flaws this login closes. The login query is open to SQL injection: a crafted email can change the statement and skip the password check. Binding the email with WHERE email = ? keeps it as data, and values that are not emails are rejected first. Search and reviews are open to cross-site scripting: a script planted there runs in another shopper's browser. Writing output as text, plus a policy that blocks inline scripts, stops that. Registration fails when the check lives only on the page or the secret is weak. The server decides identity. Passwords use bcrypt.hashSync(password, 10), and bcrypt.compareSync checks a guess without reversing the hash."""

PART_2 = """\
This is an HTML, CSS, and JavaScript login, plus account creation. validateLogin blocks an empty submit, requires @ in the email, and requires a password of at least 8 characters. The browser runs that check, and the server runs it again. Passwords are stored with bcrypt at cost 10. After sign-in, the customer can order drinks. Run npm install, then npm start, and open http://127.0.0.1:47291. The sample account is demo@juice.lab / Lemonade1. README.md has the same steps. Publish this folder on GitHub and paste that public URL here. This copy has no public link yet."""

PART_3 = """\
I tried to break this login at http://127.0.0.1:47291. An empty submit said the email and password are required. A short password was rejected for length. An email shaped like a database command was rejected with "That email or password doesn't match our records." The sample account stayed locked because the email is bound to ?. An email containing markup did not run a script. Those characters stayed in the box as text. The attack failed. The fix is the bound query and treating input as text. If that input were inserted as HTML, the browser could run it."""


def words(text: str) -> int:
    return len(text.split())


class Submission(FPDF):
    def footer(self):
        self.set_y(-14)
        self.set_font("Times", "I", 9)
        self.set_text_color(80, 70, 60)
        self.cell(0, 8, f"HW 2B  |  Juice Shop login lab  |  {self.page_no()}", align="C")


def heading(pdf: Submission, text: str):
    pdf.ln(2)
    pdf.set_text_color(36, 54, 44)
    pdf.set_font("Times", "B", 14)
    pdf.multi_cell(pdf.epw, 7, text)
    pdf.ln(1)
    pdf.set_draw_color(224, 122, 47)
    pdf.set_line_width(0.4)
    y = pdf.get_y()
    pdf.line(pdf.l_margin, y, pdf.l_margin + 42, y)
    pdf.ln(3)
    pdf.set_text_color(28, 25, 23)


def body(pdf: Submission, text: str):
    pdf.set_font("Times", size=11.5)
    pdf.set_text_color(28, 25, 23)
    pdf.multi_cell(pdf.epw, 5.6, text)
    pdf.ln(2)


def figure(pdf: Submission, filename: str, caption: str):
    path = SHOTS / filename
    with Image.open(path) as image:
        width, height = image.size
    caption_h = 16
    max_h = pdf.page_break_trigger - pdf.t_margin - caption_h
    render_w = pdf.epw
    render_h = render_w * height / width
    if render_h > max_h:
        render_h = max_h
        render_w = render_h * width / height
    if pdf.get_y() + render_h + caption_h > pdf.page_break_trigger:
        pdf.add_page()
    x = pdf.l_margin + (pdf.epw - render_w) / 2
    pdf.image(str(path), x=x, w=render_w)
    pdf.ln(1)
    pdf.set_font("Times", "I", 10)
    pdf.set_text_color(87, 83, 78)
    pdf.multi_cell(pdf.epw, 4.8, caption)
    pdf.ln(3)
    pdf.set_text_color(28, 25, 23)


def main():
    print(f"Part 1 words: {words(PART_1)}")
    print(f"Part 2 words: {words(PART_2)}")
    print(f"Part 3 words: {words(PART_3)}")

    pdf = Submission(format="Letter")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(16, 16, 16)
    pdf.add_page()

    pdf.set_text_color(36, 54, 44)
    pdf.set_font("Times", "B", 12)
    pdf.cell(0, 6, "HW 2B", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Times", "B", 20)
    pdf.multi_cell(pdf.epw, 9, "A secure login for a Juice Shop-style shop")
    pdf.ln(1)
    pdf.set_font("Times", size=11)
    pdf.set_text_color(87, 83, 78)
    pdf.multi_cell(
        pdf.epw,
        5.4,
        "Secure feature design, a login form with checks on both sides, and an attempt to break that form.",
    )
    pdf.ln(2)

    heading(pdf, "Part 1. Secure feature design")
    body(pdf, PART_1)

    heading(pdf, "Part 2. Login form")
    body(pdf, PART_2)
    figure(
        pdf,
        "login_desktop.png",
        "Figure 1. The sign-in card, with the sample account.",
    )
    figure(
        pdf,
        "login_success.png",
        "Figure 2. After sign-in, the customer can order drinks. Log out stays available.",
    )

    heading(pdf, "Part 3. Trying to break the form")
    body(pdf, PART_3)
    figure(
        pdf,
        "validation_empty.png",
        "Figure 3. An empty submit is rejected.",
    )
    figure(
        pdf,
        "sqli_rejected.png",
        "Figure 4. A database-shaped email is rejected. Sign-in does not succeed.",
    )
    figure(
        pdf,
        "xss_shown_as_text.png",
        "Figure 5. Markup in the email stays text. No script dialog ran.",
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
