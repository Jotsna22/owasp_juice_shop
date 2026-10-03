#!/usr/bin/env python3
"""Build the HW 2B submission PDF from the lab screenshots."""

from pathlib import Path

from PIL import Image
from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "docs" / "screenshots"
OUT = ROOT / "submission" / "HW2B-Juice-Shop.pdf"

PART_1 = """\
Juice Shop is published with three flaws a registration system has to close.

The login query is open to SQL injection. A crafted email can change the statement and skip the password check, which is an authentication bypass. Binding that email to a placeholder (WHERE email = ?) keeps it in a value slot, so the database does not parse it as SQL. Rejecting values that are not email addresses stops the obvious strings before they are bound.

Search results and product reviews are open to cross-site scripting. A script planted there runs in the next shopper's browser and can act with their session. Writing untrusted data as text, and sending a Content-Security-Policy that disallows inline scripts, keeps the browser from running it.

Registration and password reset fail open when the secret is weak or the check lives only in the page. The server has to decide identity. Passwords should be stored as slow hashes. bcrypt.hashSync(password, 10) writes a salted hash, and bcrypt.compareSync(password, hash) checks a guess without reversing it. A stolen table does not reveal the password, and the cost slows guessing."""

PART_2 = """\
I built a Juice Shop-style login in HTML, CSS, and JavaScript, plus a registration page. validateLogin, in public/validate.js, rejects an empty submit, requires "@" in the email, and requires at least 8 characters in the password. The browser runs that function before fetch. server.js imports the same function for POST /api/login and POST /api/register, so skipping the page script does not skip the rules.

The server stores passwords with bcrypt at cost 10 and inserts only the hash. The account lookup uses a bound parameter. Errors, and the email that was typed, are placed with textContent. A successful login sets an HttpOnly, SameSite=Strict cookie. The page can show the email and cannot read the cookie.

From this project, run npm install, then npm start, and open http://127.0.0.1:47291. The lab account is demo@juice.lab / Lemonade1. npm test covers the same checks. README.md is the runbook.

GitHub repository: publish this project as a public repository and use that URL on the submitted copy. This workspace has no public GitHub remote, so a live link is not printed here. The HTML, JavaScript, server, and README are the files to publish."""

PART_3 = """\
I tried to break the login I had just built, at http://127.0.0.1:47291.

1. I submitted the form with both fields empty. The page said "Email and password are required." The login request was not sent.

2. I entered demo@juice.lab and the password short. The page said the password must be at least 8 characters, and again did not call the server.

3. I skipped the page script and posted a classic SQL login string, a quote followed by OR 1=1 and a comment, as the email. The server returned 400 because the value has no "@". I then submitted an email-shaped string, demo@juice.lab'OR'1'='1, with the password password1. The server returned 401, "Invalid email or password." The lab account stayed locked. That string is bound to the ? placeholder and compared as an address. It is not concatenated into the SQL.

4. I typed "><svg/onload=alert(1)>@x.co as the email and Lemonade1 as the password. No alert ran. The same characters showed up in the field and in the block labeled "printed as text." The API response did not echo the markup. The page is served with script-src 'self'.

The attack did not succeed. The SQL attempt is stopped by the bound parameter, with the email check in front of it. The markup attempt is stopped by textContent. If that string had been assigned with innerHTML, the browser would have run the onload handler. Leaving it on textContent, and keeping the policy that blocks inline scripts, is the fix."""


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


def code(pdf: Submission, text: str):
    pdf.set_fill_color(244, 239, 230)
    pdf.set_font("Courier", size=9)
    pdf.multi_cell(pdf.epw, 4.6, text, fill=True)
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
    code(
        pdf,
        "const findUser = db.prepare(\n"
        '  "SELECT email, password_hash FROM users WHERE email = ?"\n'
        ");\n"
        "const user = findUser.get(normalized);\n"
        "const hash = user ? user.password_hash : dummyHash;\n"
        "const match = bcrypt.compareSync(password, hash);\n"
        "\n"
        "// registration stores the hash, never the password\n"
        "insertUser.run(normalized, bcrypt.hashSync(password, 10));",
    )
    body(
        pdf,
        "The lab form in Parts 2 and 3 uses these three controls: a bound email parameter, text output, and a bcrypt hash.",
    )

    heading(pdf, "Part 2. Login form")
    body(pdf, PART_2)
    figure(
        pdf,
        "login_desktop.png",
        "Figure 1. Login page. Email, password, and the lab account are on the card.",
    )
    figure(
        pdf,
        "validation_empty.png",
        "Figure 2. An empty submit is stopped in the browser: email and password are required.",
    )
    figure(
        pdf,
        "login_success.png",
        "Figure 3. After a valid login the server session names the account. The cookie is HttpOnly.",
    )
    figure(
        pdf,
        "login_mobile.png",
        "Figure 4. The same login stacked on a narrow screen.",
    )

    heading(pdf, "Part 3. Trying to break the form")
    body(pdf, PART_3)
    figure(
        pdf,
        "sqli_rejected.png",
        "Figure 5. An email-shaped SQL fragment is printed as text and rejected. Sign-in does not succeed.",
    )
    figure(
        pdf,
        "xss_shown_as_text.png",
        "Figure 6. A markup-shaped email is shown as text. No script dialog ran.",
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
