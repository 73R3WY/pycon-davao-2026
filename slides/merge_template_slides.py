#!/usr/bin/env python3
"""
merge_template_slides.py — append the official template's reference pages to the
generated deck as HIDDEN slides.

Usage:  python3 merge_template_slides.py <deck.pptx> <template.pptx>

PURPOSE: the organizers' template ships 7 pages (layout samples, branding,
typography, colour palette, assets). They must stay in the submitted file for
reference but never show during the talk, so each is appended with show="0".
Only the standard library is used; the deck is rewritten in place.
"""

import re
import sys
import uuid
import zipfile

SLIDE_CT = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"
REL_SLIDE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"


def main(deck_path: str, template_path: str) -> None:
    deck = zipfile.ZipFile(deck_path)
    tpl = zipfile.ZipFile(template_path)
    parts = {info.filename: deck.read(info.filename) for info in deck.infolist()}
    order = [info.filename for info in deck.infolist()]

    pres = parts["ppt/presentation.xml"].decode()
    pres_rels = parts["ppt/_rels/presentation.xml.rels"].decode()
    ctypes = parts["[Content_Types].xml"].decode()

    existing = sorted(int(m.group(1)) for n in parts for m in [re.fullmatch(r"ppt/slides/slide(\d+)\.xml", n)] if m)
    assert existing, "deck has no slides?"
    next_no = (existing[-1] if existing else 0) + 1
    max_sld_id = max(int(i) for i in re.findall(r'<p:sldId id="(\d+)"', pres))
    first_layout = sorted(n for n in parts if re.match(r"ppt/slideLayouts/slideLayout\d+\.xml$", n))[0].split("/")[-1]

    # Template slides in presentation order.
    tpl_pres = tpl.read("ppt/presentation.xml").decode()
    tpl_prels = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', tpl.read("ppt/_rels/presentation.xml.rels").decode()))
    tpl_slides = [tpl_prels[r] for r in re.findall(r'<p:sldId [^>]*r:id="(rId\d+)"', tpl_pres)]

    new_sld_ids, new_rids = [], []
    for i, target in enumerate(tpl_slides):
        src = "ppt/" + target.lstrip("/")
        src_name = src.split("/")[-1]
        xml = tpl.read(src).decode("utf8")
        rels = tpl.read(f"ppt/slides/_rels/{src_name}.rels").decode("utf8")

        kept = []
        for rel in re.findall(r"<Relationship [^>]+/>", rels):
            rtype = re.search(r'Type="([^"]+)"', rel).group(1)
            rtarget = re.search(r'Target="([^"]+)"', rel).group(1)
            if rtype.endswith("/notesSlide"):
                continue  # notes pages are not carried over
            if rtype.endswith("/slideLayout"):
                rel = rel.replace(f'Target="{rtarget}"', f'Target="../slideLayouts/{first_layout}"')
            elif rtype.endswith("/image"):
                media = rtarget.split("/")[-1]
                new_media = f"ppt/media/tpl_{media}"
                if new_media not in parts:
                    parts[new_media] = tpl.read("ppt/media/" + media)
                    order.append(new_media)
                rel = rel.replace(f'Target="{rtarget}"', f'Target="../media/tpl_{media}"')
            kept.append(rel)
        rels = re.sub(r"<Relationship [^>]+/>", "", rels)
        rels = rels.replace("</Relationships>", "".join(kept) + "</Relationships>")

        # Hide the slide.
        xml = re.sub(r"<p:sld(\s|>)", lambda m: '<p:sld show="0"' + m.group(1), xml, count=1) if 'show="0"' not in xml[:600] else xml

        no = next_no + i
        parts[f"ppt/slides/slide{no}.xml"] = xml.encode("utf8")
        parts[f"ppt/slides/_rels/slide{no}.xml.rels"] = rels.encode("utf8")
        order += [f"ppt/slides/slide{no}.xml", f"ppt/slides/_rels/slide{no}.xml.rels"]

        rid = f"rIdTpl{no}"
        sld_id = max_sld_id + 1 + i
        new_rids.append(f'<Relationship Id="{rid}" Type="{REL_SLIDE}" Target="slides/slide{no}.xml"/>')
        new_sld_ids.append(sld_id)
        pres = pres.replace("</p:sldIdLst>", f'<p:sldId id="{sld_id}" r:id="{rid}"/></p:sldIdLst>')
        ctypes = ctypes.replace("</Types>", f'<Override PartName="/ppt/slides/slide{no}.xml" ContentType="{SLIDE_CT}"/></Types>')

    # Image extensions the template uses must have a Default content type.
    for ext, ct in (("png", "image/png"), ("jpg", "image/jpeg"), ("jpeg", "image/jpeg")):
        if f'Extension="{ext}"' not in ctypes:
            ctypes = ctypes.replace("<Override", f'<Default Extension="{ext}" ContentType="{ct}"/><Override', 1)

    pres_rels = pres_rels.replace("</Relationships>", "".join(new_rids) + "</Relationships>")

    # Put the hidden slides in their own section so they do not land in a stray "Default" one.
    if "</p14:sectionLst>" in pres:
        ids = "".join(f'<p14:sldId id="{i}"/>' for i in new_sld_ids)
        section = f'<p14:section name="Template reference (hidden)" id="{{{str(uuid.uuid4()).upper()}}}"><p14:sldIdLst>{ids}</p14:sldIdLst></p14:section>'
        pres = pres.replace("</p14:sectionLst>", section + "</p14:sectionLst>")

    parts["ppt/presentation.xml"] = pres.encode("utf8")
    parts["ppt/_rels/presentation.xml.rels"] = pres_rels.encode("utf8")
    parts["[Content_Types].xml"] = ctypes.encode("utf8")

    with zipfile.ZipFile(deck_path, "w", zipfile.ZIP_DEFLATED) as out:
        for name in order:
            out.writestr(name, parts[name])
    print(f"merged {len(tpl_slides)} hidden template slides (slides {next_no}-{next_no + len(tpl_slides) - 1})")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
