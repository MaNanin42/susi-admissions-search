import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
TYPE_ORDER = {"contract": 0, "advanced": 1}
SOURCE_EXPECTATIONS = {
    "contract": {
        "role": "contract-program-directory",
        "label": "계약학과",
        "title": "2027학년도 계약학과 현황",
        "pages": 15,
        "rows": 77,
        "universities": 42,
        "linked": 35,
        "linkedKeys": 35,
        "review": 42,
    },
    "advanced": {
        "role": "advanced-program-directory",
        "label": "첨단학과",
        "title": "2027학년도 첨단학과 현황",
        "pages": 62,
        "rows": 316,
        "universities": 89,
        "linked": 220,
        "linkedKeys": 217,
        "review": 96,
    },
}
UNIVERSITY_BASE_ALIASES = {
    "포항공과대": "포항공대",
    "한국기술교육대": "한국기술교대",
    "국립금오공과대": "국립금오공대",
    "서울과학기술대": "서울과기대",
    "한국외국어대": "한국외대",
    "한밭대": "국립한밭대",
}


def clean(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\n", " ")).strip()


def norm(value):
    value = unicodedata.normalize("NFKC", clean(value)).lower()
    return re.sub(r"[^0-9a-z가-힣]", "", value)


def university_base(value):
    base = norm(clean(value).split("(", 1)[0])
    return norm(UNIVERSITY_BASE_ALIASES.get(base, base))


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def extract_rows(path):
    rows = []
    last_region = ""
    last_university = ""
    with pdfplumber.open(path) as pdf:
        page_count = len(pdf.pages)
        for page_no, page in enumerate(pdf.pages, 1):
            for table in page.extract_tables():
                if not table or len(table[0]) < 3:
                    continue
                if [clean(value) for value in table[0][:3]] != ["지역", "대학", "학과명"]:
                    continue
                for source_row in table[1:]:
                    if len(source_row) < 3:
                        continue
                    region, university, major = [clean(value) for value in source_row[:3]]
                    if region:
                        last_region = region
                    if university:
                        last_university = university
                    if major:
                        rows.append({
                            "page": page_no,
                            "region": last_region,
                            "university": last_university,
                            "major": major,
                        })
    return page_count, rows


def build_baseline_indexes(admissions):
    universities = sorted({row["u"] for row in admissions})
    by_university = {}
    by_base = {}
    for row in admissions:
        by_university.setdefault(row["u"], set()).add(row["m"])
    for university in universities:
        by_base.setdefault(university_base(university), []).append(university)
    return by_university, by_base


def exact_link(row, by_university, by_base):
    candidates = by_base.get(university_base(row["university"]), [])
    major_norm = norm(row["major"])
    matches = sorted({
        (university, major)
        for university in candidates
        for major in by_university[university]
        if norm(major) == major_norm
    })
    return matches[0] if len(matches) == 1 else None


def source_path_from_manifest(manifest, role):
    item = next((source for source in manifest["sources"] if source["role"] == role), None)
    if not item:
        raise RuntimeError(f"source manifest role missing: {role}")
    path = (ROOT / item["relativeLocator"]).resolve()
    if not path.is_file():
        raise RuntimeError(f"source file missing: {path}")
    if path.stat().st_size != item["bytes"]:
        raise RuntimeError(f"source byte count mismatch: {path.name}")
    if sha256(path) != item["sha256"]:
        raise RuntimeError(f"source sha256 mismatch: {path.name}")
    return path


def generate():
    manifest = json.loads((ROOT / "sources/source-manifest.json").read_text(encoding="utf-8"))
    admissions = json.loads((ROOT / "data/baseline/admissions.json").read_text(encoding="utf-8"))
    update_audit = json.loads((ROOT / "docs/data-update-audit-260813.json").read_text(encoding="utf-8"))
    future_new_keys = {
        (item["university"], item["major"])
        for item in update_audit["comparison"]["newKeys"]
    }
    by_university, by_base = build_baseline_indexes(admissions)
    links = {}
    source_stats = {}
    audit_sources = {}

    for source_type, expected in SOURCE_EXPECTATIONS.items():
        path = source_path_from_manifest(manifest, expected["role"])
        page_count, rows = extract_rows(path)
        if page_count != expected["pages"]:
            raise RuntimeError(f"{source_type} page count: {page_count}")
        if len(rows) != expected["rows"]:
            raise RuntimeError(f"{source_type} table row count: {len(rows)}")
        university_count = len({row["university"] for row in rows})
        if university_count != expected["universities"]:
            raise RuntimeError(f"{source_type} university count: {university_count}")

        linked = 0
        linked_keys = set()
        review_rows = []
        future_matches = []
        for row in rows:
            match = exact_link(row, by_university, by_base)
            if match:
                linked += 1
                key = match
                linked_keys.add(key)
                item = links.setdefault(key, {"u": match[0], "m": match[1], "tags": []})
                item["tags"].append({"type": source_type, "pages": [row["page"]]})
                continue

            candidates = by_base.get(university_base(row["university"]), [])
            future = sorted({
                (university, major)
                for university, major in future_new_keys
                if university in candidates and norm(major) == norm(row["major"])
            })
            if future:
                future_matches.extend(future)
            review_rows.append({
                "page": row["page"],
                "university": row["university"],
                "major": row["major"],
                "reason": "future-new-key" if future else "name-or-key-review",
            })

        review_count = len(review_rows)
        if linked != expected["linked"] or len(linked_keys) != expected["linkedKeys"] or review_count != expected["review"]:
            raise RuntimeError(
                f"{source_type} mapping count: linked={linked}, linkedKeys={len(linked_keys)}, review={review_count}"
            )

        source_stats[source_type] = {
            "label": expected["label"],
            "title": expected["title"],
            "publisher": "한국대학교육협의회",
            "pages": page_count,
            "sourceRows": len(rows),
            "sourceUniversities": university_count,
            "linkedRows": linked,
            "linkedKeys": len(linked_keys),
            "reviewRows": review_count,
        }
        audit_sources[source_type] = {
            **source_stats[source_type],
            "futureNewKeyExact": [
                {"u": university, "m": major}
                for university, major in sorted(set(future_matches))
            ],
            "reviewReasonCounts": dict(sorted(Counter(row["reason"] for row in review_rows).items())),
            "reviewExamples": review_rows[:8],
        }

    public_links = []
    for item in sorted(links.values(), key=lambda row: (row["u"], row["m"])):
        merged_tags = {}
        for tag in item["tags"]:
            merged_tags.setdefault(tag["type"], set()).update(tag["pages"])
        item["tags"] = [
            {"type": source_type, "pages": sorted(pages)}
            for source_type, pages in sorted(merged_tags.items(), key=lambda pair: TYPE_ORDER[pair[0]])
        ]
        public_links.append(item)

    data = {
        "schemaVersion": 1,
        "sourceYear": 2027,
        "publisher": "한국대학교육협의회",
        "notice": "학과 분류 참고 자료이며 입결·모집요강·채용 보장을 의미하지 않습니다.",
        "sources": source_stats,
        "links": public_links,
    }
    audit = {
        "recordedAt": "2026-08-30",
        "baseline": {
            "admissionsRows": len(admissions),
            "universityMajorKeys": len({(row["u"], row["m"]) for row in admissions}),
        },
        "mappingPolicy": {
            "rule": "대학 후보 안에서 공백·문장부호만 정규화한 모집단위명이 유일하게 정확 일치할 때만 공개 태그로 연결",
            "universityAliases": UNIVERSITY_BASE_ALIASES,
            "excluded": "단과대학명 포함, 복수 학과 병기, 군·성별 분리, 개편 전후 명칭, 현재 기준선에 없는 키",
        },
        "sources": audit_sources,
        "publicLinkCount": len(public_links),
        "decision": "검증된 정확 일치만 V10.7.2 보조 태그로 공개하고 검토 행은 입결 결과에 연결하지 않는다.",
    }
    return data, audit


def serialize(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Generate verified 2027 contract/advanced program tags")
    parser.add_argument("--write", action="store_true", help="write generated data and audit files")
    args = parser.parse_args()
    data, audit = generate()
    targets = {
        ROOT / "data/program-tags.json": serialize(data),
        ROOT / "docs/program-tags-audit-270830.json": serialize(audit),
    }
    if args.write:
        for path, content in targets.items():
            path.write_text(content, encoding="utf-8", newline="\n")
            print(f"wrote {path}")
        return
    for path, expected in targets.items():
        if not path.is_file() or path.read_text(encoding="utf-8") != expected:
            raise RuntimeError(f"generated content differs: {path}")
    print("[PASS] program tag data and audit match source PDFs")


if __name__ == "__main__":
    main()
