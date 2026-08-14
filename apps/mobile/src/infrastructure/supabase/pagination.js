const DEFAULT_PAGE_SIZE = 500;

export async function fetchAllRows(createQuery, pageSize = DEFAULT_PAGE_SIZE) {
  const rows = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const response = await createQuery().range(from, from + pageSize - 1);

    if (response.error) {
      throw response.error;
    }

    const pageRows = response.data || [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      return rows;
    }

    page += 1;
  }
}
