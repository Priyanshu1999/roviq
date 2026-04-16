/**
 * Debounces a fast-changing value so downstream effects fire at most once
 * per `delay` ms of idle. Drop-in replacement for "useQuery on every
 * keystroke" antipatterns: wrap the input state, pass the debounced value
 * to the query.
 *
 * Example:
 *   const [search, setSearch] = useState('');
 *   const debouncedSearch = useDebouncedValue(search, 250);
 *   useQuery(PICKER, { variables: { search: debouncedSearch } });
 *
 * At 250ms a reasonable typist emits ~1 request per word instead of 5–10.
 */
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}
