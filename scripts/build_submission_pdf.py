#!/usr/bin/env python3
"""Build the HW 2B submission PDF from the lab screenshots."""

from pathlib import Path

from PIL import Image
from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "docs" / "screenshots"
OUT = ROOT / "submission" / "HW2B-Juice-Shop.pdf"

PART_1 = [
    (
        "1. SQL injection on login",
        "A crafted email can change the database command and skip the password check, so someone signs in without the real password.",
        "Bind the email with WHERE email = ?, so it stays data. Reject values that are not email addresses.",
    ),
    (
        "2. Cross-site scripting in search and reviews",
        "A script planted in search or a review runs in the next shopper's browser and can use their signed-in session.",
        "Write that input as text, and block inline scripts with a Content-Security-Policy.",
    ),
    (
        "3. Weak registration and password storage",
        "A check that lives only on the page, or a weak reset secret, lets someone claim an account. A stolen database exposes plaintext or fast hashes.",
        "The server decides identity. Store passwords with bcrypt.hashSync(password, 10). bcrypt.compareSync checks a guess without reversing the hash.",
    ),
]

REPO_URL = "https://github.com/Jotsna22/owasp_juice_shop"
PART_2 = f"""\
This is an HTML, CSS, and JavaScript login, plus account creation. validateLogin blocks an empty submit, requires @ in the email, and requires a password of at least 8 characters. The browser runs that check, and the server runs it again. Passwords are stored with bcrypt at cost 10. After sign-in, the customer can order drinks. Run npm install, then npm start, and open http://127.0.0.1:47291. The sample account is demo@juice.lab / Lemonade1. README.md has the same steps. Clone the repository, then use those same commands. The repository is {REPO_URL}."""

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
    pdf.multi_cell(pdf.epw, 5.6, text, align="L")
    pdf.ln(2)


def repository_link(pdf: Submission, url: str):
    pdf.set_font("Times", size=11.5)
    pdf.set_text_color(20, 78, 140)
    pdf.cell(pdf.epw, 6, url, link=url, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_text_color(28, 25, 23)


def vulnerability(pdf: Submission, title: str, problem: str, fix: str):
    pdf.set_x(pdf.l_margin)
    pdf.set_text_color(36, 54, 44)
    pdf.set_font("Times", "B", 12)
    pdf.multi_cell(0, 6, title)
    pdf.set_text_color(28, 25, 23)
    for label, text in (("Problem", problem), ("Fix", fix)):
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Times", "B", 11.5)
        pdf.multi_cell(0, 5.6, label)
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Times", size=11.5)
        pdf.multi_cell(0, 5.6, text)
        pdf.ln(0.6)
    pdf.ln(1.5)


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
    print(f"Part 1 words: {words(' '.join(' '.join(item) for item in PART_1))}")
    print(f"Part 2 words: {words(PART_2)}")
    print(f"Part 3 words: {words(PART_3)}")

    pdf = Submission(format="Letter")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(16, 16, 16)
    pdf.add_page()

    pdf.set_text_color(36, 54, 44)
    pdf.set_font("Times", "B", 20)
    pdf.multi_cell(pdf.epw, 9, "OWASP Juice Shop")
    pdf.ln(2)

    heading(pdf, "Part 1. Secure feature design")
    for title, problem, fix in PART_1:
        vulnerability(pdf, title, problem, fix)

    heading(pdf, "Part 2. Login form")
    prose, _, _url = PART_2.rpartition(REPO_URL)
    body(pdf, prose.rstrip())
    repository_link(pdf, REPO_URL)
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
