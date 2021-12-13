const expect = require('expect-runtime');
const BaseRepository = require('./BaseRepository');

class StakeholderRepository extends BaseRepository {
  constructor(session) {
    super('stakeholder', session);
    this._tableName = 'stakeholder';
    this._session = session;
  }

  async getAllStakeholders(options) {
    const stakeholders = this._session
      .getDB()(this._tableName)
      .select('*')
      .orderBy('org_name', 'asc')
      .limit(options.limit)
      .offset(options.offset);

    const count = await this._session.getDB()(this._tableName).count('*');

    return { stakeholders, count: +count[0].count };
  }

  async getStakeholderById(id) {
    let stakeholder_uuid = null;
    let stakeholder_id = null;
    if (Number.isInteger(id)) {
      stakeholder_id = id;
    } else {
      stakeholder_uuid = id;
    }

    const stakeholder = await this._session
      .getDB()(this._tableName)
      .select('*')
      .where('id', '=', stakeholder_id)
      .orWhere('stakeholder_uuid', '=', stakeholder_uuid)
      .first();

    return { stakeholder };
  }

  async getAllStakeholderTrees(options) {
    // get only non-child to start building trees
    const results = await this._session
      .getDB()('stakeholder as s')
      .select('s.*')
      .leftJoin(
        'stakeholder_relations as sr',
        'stakeholder_uuid',
        'sr.child_id',
      )
      .where('sr.child_id', null)
      .orderBy('org_name', 'asc')
      .limit(options.limit)
      .offset(options.offset);

    const stakeholders = await Promise.all(
      results.map(async (stakeholder) => {
        // eslint-disable-next-line no-param-reassign
        stakeholder.parents = await this.getParents(
          stakeholder.stakeholder_uuid,
        );
        // eslint-disable-next-line no-param-reassign
        stakeholder.children = await this.getChildren(stakeholder, options);
        return stakeholder;
      }),
    );

    // count all the stakeholder whether parent or child?
    const count = await this._session.getDB()(this._tableName).count('*');

    return { stakeholders, count: +count[0].count };
  }

  async getStakeholderTreeById(id, options) {
    let stakeholder_uuid = null;
    let stakeholder_id = null;
    if (Number.isInteger(id)) {
      stakeholder_id = id;
    } else {
      stakeholder_uuid = id;
    }

    const stakeholder = await this._session
      .getDB()(this._tableName)
      .select('*')
      .where('id', '=', stakeholder_id)
      .orWhere('stakeholder_uuid', '=', stakeholder_uuid)
      .first();

    // only get one step generation difference, no recursion
    stakeholder.parents = await this.getParents(stakeholder.stakeholder_uuid);
    stakeholder.children = await this.getChildren(stakeholder, options);

    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .where('id', id)
      .orWhere('stakeholder_uuid', stakeholder_uuid);

    return { stakeholders: [stakeholder], count: +count[0].count };
  }

  async getParentIds(id) {
    const parents = await this._session
      .getDB()(this._tableName)
      .select('stakeholder_relations.parent_id')
      .join(
        'stakeholder_relations',
        'stakeholder_uuid',
        'stakeholder_relations.child_id',
      )
      .where('stakeholder_uuid', id);

    return parents ? parents.map((parent) => parent.parent_id) : [];
  }

  async getParents(id) {
    const parentIds = await this.getParentIds(id);

    if (parentIds.length) {
      return this._session
        .getDB()(this._tableName)
        .select('*')
        .whereIn('stakeholder_uuid', parentIds);
    }

    return [];
  }

  async getChildrenIds(id) {
    const children = await this._session
      .getDB()(this._tableName)
      .select('stakeholder_relations.child_id')
      .join(
        'stakeholder_relations',
        'stakeholder_uuid',
        'stakeholder_relations.parent_id',
      )
      .where('stakeholder_uuid', id);

    return children ? children.map((child) => child.child_id) : [];
  }

  async getChildren(parent, options) {
    const childrenIds = await this.getChildrenIds(parent.stakeholder_uuid);

    if (childrenIds.length) {
      const children = await this._session
        .getDB()(this._tableName)
        .select('*')
        .whereIn('stakeholder_uuid', childrenIds)
        .orderBy('org_name', 'asc')
        .limit(options.limit)
        .offset(options.offset);

      // don't want to keep getting all of the parents and children recursively, but do want to
      // include the current stakeholder as parent
      return children.map((child) => {
        // eslint-disable-next-line no-param-reassign
        child.parents = [{ ...parent }];
        return child;
      });
    }
    return [];
  }

  async getFilter(filter, options) {
    // const { org_name, first_name, last_name, email, phone, ...otherFilters } =
    //   filter;

    const results = await this._session
      .getDB()(this._tableName)
      .select('*')
      .where({ ...filter })
      // .where((builder) =>
      //   org_name && first_name && last_name
      //     ? builder
      //         .where({ ...otherFilters })
      //         .orWhere('org_name', 'like', org_name)
      //         .orWhere('first_name', 'like', first_name)
      //         .orWhere('last_name', 'like', last_name)
      //     : builder.where({ ...otherFilters }),
      // )
      .orderBy('org_name', 'asc')
      .limit(options.limit)
      .offset(options.offset);

    const stakeholders = await Promise.all(
      results.map(async (stakeholder) => {
        // eslint-disable-next-line no-param-reassign
        stakeholder.parents = await this.getParents(
          stakeholder.stakeholder_uuid,
        );
        // eslint-disable-next-line no-param-reassign
        stakeholder.children = await this.getChildren(stakeholder, options);
        return stakeholder;
      }),
    );

    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .where({ ...filter });
    // .where((builder) =>
    //   org_name && first_name && last_name
    //     ? builder
    //         .where({ ...otherFilters })
    //         .orWhere('org_name', 'like', org_name)
    //         .orWhere('first_name', 'like', first_name)
    //         .orWhere('last_name', 'like', last_name)
    //     : builder.where({ ...otherFilters }),
    // );

    return { stakeholders, count: +count[0].count };
  }

  async getRelatedIds(id) {
    let stakeholder_uuid = null;
    let stakeholder_id = null;
    if (Number.isInteger(+id)) {
      stakeholder_id = id;
    } else if (id !== 'null') {
      stakeholder_uuid = id;
    }

    const relatedIds = await this._session
      .getDB()('stakeholder as s')
      .select('sr.child_id', 'sr.parent_id')
      .join('stakeholder_relations as sr', function () {
        this.on(function () {
          this.on('stakeholder_uuid', '=', 'sr.child_id');
          this.orOn('stakeholder_uuid', '=', 'sr.parent_id');
        });
      })
      .where('s.stakeholder_uuid', stakeholder_uuid)
      .orWhere('s.id', stakeholder_id);

    const ids = new Set();
    relatedIds.forEach((stakeholder) => {
      ids.add(stakeholder.parent_id);
      ids.add(stakeholder.child_id);
    });

    return Array.from(ids);
  }

  async getFilterById(id, filter, options) {
    // PARTIAL SEARCH IN PROGRESS

    // const {
    //   org_name,
    //   first_name,
    //   last_name,
    //   email,
    //   phone, ...otherFilters,
    // } = filter;

    const relatedIds = await this.getRelatedIds(id);

    // const searchFields = Object.entries({
    //   org_name,
    //   first_name,
    //   last_name,
    //   email,
    //   phone,
    // });

    // console.log('filter cols -------->', searchFields);
    // console.log('other filters -------->', otherFilters);

    // const searchString = searchFields
    //   .reduce((acc, [key, value]) => {
    //     if (value) {
    //       acc.push(`"${key}" like "${value}"`);
    //     }
    //     return acc;
    //   }, [])
    //   .join(' and ');

    // console.log('searchString', searchString);

    const stakeholders = await this._session
      .getDB()(this._tableName)
      .select('*')
      .whereIn('stakeholder_uuid', relatedIds)
      .andWhere({ ...filter })
      // .andWhere(this._session.getDB().raw(searchString))
      .orderBy('org_name', 'asc')
      .limit(options.limit)
      .offset(options.offset);

    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .whereIn('stakeholder_uuid', relatedIds)
      .andWhere({ ...filter });

    return { stakeholders, count: +count[0].count };
  }

  async createStakeholder(id, object) {
    const created = await this._session
      .getDB()(this._tableName)
      .insert(object)
      .returning('*');

    expect(created).match([
      {
        id: expect.anything(),
      },
    ]);

    return created[0];
  }

  async updateStakeholder(id, object) {
    const updated = await this._session
      .getDB()(this._tableName)
      .where('id', object.id)
      .update(object, ['*']);

    expect(updated).match([
      {
        id: expect.anything(),
      },
    ]);

    return updated[0];
  }

  async getUnlinkedStakeholders(id) {
    const relatedIds = await this.getRelatedIds(id);
    const ids = relatedIds || [];

    const stakeholders = await this._session
      .getDB()(this._tableName)
      .select('*')
      .whereNotIn('stakeholder_uuid', ids)
      .orderBy('org_name', 'asc');

    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .whereNotIn('stakeholder_uuid', ids);

    return { stakeholders, count: +count[0].count };
  }

  async updateLinkStakeholder(stakeholder_id, { type, linked, data }) {
    let linkedStakeholders;

    if (linked) {
      // to link
      const insertObj = {};

      if (type === 'parents' || type === 'children') {
        insertObj.parent_id =
          type === 'parents' ? data.stakeholder_uuid : stakeholder_id;
        insertObj.child_id =
          type === 'children' ? data.stakeholder_uuid : stakeholder_id;
      }
      // need to update db relation table before implementing
      // insertObj.grower_id = type === 'growers' ? id : null;
      // insertObj.user_id = type === 'users' ? id : null;

      linkedStakeholders = await this._session
        .getDB()('stakeholder_relations')
        .insert(insertObj)
        .returning('*');

      expect(linkedStakeholders[0]).to.have.property('parent_id');
    } else {
      // to unlink
      const removeObj = {};

      if (type === 'parents' || type === 'children') {
        removeObj.parent_id =
          type === 'parents' ? data.stakeholder_uuid : stakeholder_id;
        removeObj.child_id =
          type === 'children' ? data.stakeholder_uuid : stakeholder_id;
      }

      linkedStakeholders = await this._session
        .getDB()('stakeholder_relations')
        .where(removeObj)
        .del()
        .returning('*');

      expect(linkedStakeholders).to.match([
        {
          id: expect.anything(),
        },
      ]);
    }

    return linkedStakeholders[0];
  }
}

module.exports = StakeholderRepository;
