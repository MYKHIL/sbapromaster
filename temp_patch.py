from pathlib import Path
p = Path('components/auth/YearTermSelector.tsx')
text = p.read_text(encoding='utf-8')
start = text.index('const [mostRecentDocId, setMostRecentDocId] = useState<string | null>(null);')
end = text.index('const loadPeriods = async (forceRefresh', start)
replace = '''const [mostRecentDocId, setMostRecentDocId] = useState<string | null>(null);
    const [expandedYear, setExpandedYear] = useState<string | null>(null);

    const getTermRank = (term: str) -> int:
        normalized = term.lower()
        if 'first' in normalized:
            return 1
        if 'second' in normalized:
            return 2
        if 'third' in normalized:
            return 3
        numeric_match = re.search(r'\\d+', normalized)
        return int(numeric_match.group(0)) if numeric_match else 0
'''
