//! Splitting a reply into bursts: short messages that end at a full stop, a question mark or an exclamation mark.

/// Words whose full stop does not end a sentence. Compared lowercase, with the stop left off.
const ABBREVIATIONS: &[&str] = &[
    "e.g", "i.e", "mr", "mrs", "ms", "dr", "prof", "vs", "st", "etc", "approx",
];

/// What `split_bursts` found: the finished bursts and the text after the last one, which may still grow.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Split {
    pub complete: Vec<String>,
    pub rest: String,
}

/// A stop at `index` (a byte offset of `.`) is not a sentence end when the word it closes is an abbreviation,
/// a single letter, or a list number at the start of the segment.
fn is_stop_word(segment_before: &str) -> bool {
    let word = segment_before
        .rsplit(char::is_whitespace)
        .next()
        .unwrap_or("")
        .trim_start_matches(|c: char| !c.is_alphanumeric())
        .to_lowercase();
    if ABBREVIATIONS.contains(&word.as_str()) {
        return true;
    }
    let is_number = !word.is_empty() && word.chars().all(|c| c.is_ascii_digit());
    is_number && segment_before.trim_start().len() == word.len()
}

/// Cuts `text` after each `.`, `?` or `!` that is followed by whitespace. The end of the text counts as a boundary only
/// when `finished` is true; until then the last sentence stays in `rest`, because more of it may be coming (`e.` ... `g.`).
/// With `finished`, `rest` is always empty. Each burst is trimmed; empty ones are dropped.
pub fn split_bursts(text: &str, finished: bool) -> Split {
    let mut complete = Vec::new();
    let mut start = 0;
    let mut chars = text.char_indices().peekable();
    while let Some((index, c)) = chars.next() {
        if !matches!(c, '.' | '?' | '!') {
            continue;
        }
        let end = index + c.len_utf8();
        let boundary = match chars.peek() {
            Some((_, next)) => next.is_whitespace(),
            None => finished,
        };
        if !boundary || (c == '.' && is_stop_word(&text[start..index])) {
            continue;
        }
        let burst = text[start..end].trim();
        if !burst.is_empty() {
            complete.push(burst.to_string());
        }
        start = end;
    }
    let rest = text[start..].trim();
    if finished {
        if !rest.is_empty() {
            complete.push(rest.to_string());
        }
        return Split {
            complete,
            rest: String::new(),
        };
    }
    Split {
        complete,
        rest: text[start..].trim_start().to_string(),
    }
}

/// The bursts of a finished text.
pub fn bursts_of(text: &str) -> Vec<String> {
    split_bursts(text, true).complete
}

/// The text a reply adds up to: its bursts joined with spaces.
pub fn join_bursts(bursts: &[String]) -> String {
    bursts.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn splits_at_full_stop_question_and_exclamation() {
        assert_eq!(
            bursts_of("Hello there. How are you? Great!"),
            v(&["Hello there.", "How are you?", "Great!"])
        );
    }

    #[test]
    fn text_without_a_stop_is_one_burst() {
        assert_eq!(bursts_of("no stop here"), v(&["no stop here"]));
    }

    #[test]
    fn empty_text_has_no_bursts() {
        assert!(bursts_of("").is_empty());
        assert!(bursts_of("   ").is_empty());
    }

    #[test]
    fn abbreviations_do_not_split() {
        assert_eq!(
            bursts_of("Use fruit, e.g. apples. Ask Dr. Smith."),
            v(&["Use fruit, e.g. apples.", "Ask Dr. Smith."])
        );
    }

    #[test]
    fn a_stop_inside_a_number_or_word_does_not_split() {
        assert_eq!(bursts_of("It costs 2.50 today."), v(&["It costs 2.50 today."]));
    }

    #[test]
    fn a_list_number_at_the_start_does_not_split() {
        assert_eq!(bursts_of("1. First. 2. Second."), v(&["1. First.", "2. Second."]));
    }

    #[test]
    fn while_streaming_the_last_sentence_waits() {
        let split = split_bursts("One. Two. Thr", false);
        assert_eq!(split.complete, v(&["One.", "Two."]));
        assert_eq!(split.rest, "Thr");
        let split = split_bursts("One. Two.", false);
        assert_eq!(split.complete, v(&["One."]));
        assert_eq!(split.rest, "Two.");
    }

    #[test]
    fn joined_bursts_make_the_text() {
        let bursts = bursts_of("A b.  C d?\nE!");
        assert_eq!(join_bursts(&bursts), "A b. C d? E!");
    }
}
