const select = document.querySelector('#scene-look');
const query = new URLSearchParams(location.search);
select.value = query.get('look') === 'alpine' ? 'alpine' : 'clouds';
select.addEventListener('change', () => {
  const url = new URL(location.href);
  url.searchParams.set('view', 'final');
  if (select.value === 'alpine') url.searchParams.set('look', 'alpine');
  else url.searchParams.delete('look');
  location.assign(url);
});
