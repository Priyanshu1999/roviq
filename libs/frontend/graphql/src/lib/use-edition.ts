'use client';

import { gql } from '@apollo/client/core';
import { useQuery } from '@apollo/client/react';

const EDITION_QUERY = gql`
  query Edition {
    edition
  }
`;

export function useEdition() {
  const { data } = useQuery<{ edition: string }>(EDITION_QUERY, {
    fetchPolicy: 'cache-first',
  });
  return data?.edition ?? 'ce';
}
