-- Run this in your Supabase SQL Editor

create table if not exists road_reports (
  id bigint primary key generated always as identity,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Common Fields
  latitude double precision not null,
  longitude double precision not null,
  district text not null, -- Kecamatan
  photo_url text,
  description text,
  
  -- Reporter Info (Public)
  reporter_name text,
  reporter_contact text,
  
  -- Admin/Technical Data
  report_source text not null check (report_source in ('public', 'admin')),
  damage_length float, -- in meters
  damage_width float, -- in meters
  report_date date, -- Tanggal pelaporan/foto
  
  -- Condition Indexes (For Map Coloring)
  sdi_value float, -- Surface Distress Index
  sdi_category text, -- Baik, Sedang, Rusak Ringan, Rusak Berat
  
  pci_value float, -- Pavement Condition Index
  pci_category text -- Excellent, Good, Fair, Poor, Very Poor, Serious, Failed
);

-- Enable Row Level Security (RLS)
alter table road_reports enable row level security;

-- Policy: Everyone can read reports (for the map)
drop policy if exists "Public can view reports" on road_reports;
create policy "Public can view reports"
on road_reports for select
to public
using (true);

-- Policy: Everyone can insert reports (for public reporting)
drop policy if exists "Public can insert reports" on road_reports;
create policy "Public can insert reports"
on road_reports for insert
to public
with check (true);

-- Storage bucket for photos (optional, run only if you haven't created a 'photos' bucket)
insert into storage.buckets (id, name, public) 
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "Public can upload photos" on storage.objects;
create policy "Public can upload photos"
on storage.objects for insert
to public
with check (bucket_id = 'photos');

drop policy if exists "Public can view photos" on storage.objects;
create policy "Public can view photos"
on storage.objects for select
to public
using (bucket_id = 'photos');

-- NEW: Status for Admin Workflow
alter table road_reports 
add column if not exists status text default 'pending' check (status in ('pending', 'verified', 'rejected')),
add column if not exists deleted_at timestamp with time zone;

-- Ensure Update Policy exists (Drop first to avoid conflicts if running multiple times)
drop policy if exists "Public can update reports" on road_reports;

create policy "Public can update reports"
on road_reports for update
to public
using (true)
with check (true);
