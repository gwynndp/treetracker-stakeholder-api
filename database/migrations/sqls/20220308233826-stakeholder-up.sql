CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE stakeholder (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    type varchar NOT NULL,
    org_name varchar,
    first_name varchar,
    last_name varchar,
    email varchar NOT NULL,
    phone varchar NOT NULL,
    password varchar,
    wallet varchar,
    salt varchar,
    website varchar,
    logo_url varchar,
    map varchar,
    pwd_reset_required boolean,
    offering_pay_to_plant boolean,
    organization_id integer,
    active_contract_id uuid,
    tree_validation_contract_id uuid,
    owner_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);