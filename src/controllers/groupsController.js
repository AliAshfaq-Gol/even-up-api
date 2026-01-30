const Group = require('../models/Group');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseHandler');

exports.createGroup = async (req, res) => {
  try {
    const { name, description, members } = req.body;
    const currentUserId = req.user.user_id;

    if (!name) {
      return errorResponse(res, 'Group name is required', 400);
    }

    const memberIds = members && Array.isArray(members) ? [...new Set(members)] : [];
    
    if (!memberIds.includes(currentUserId)) {
      memberIds.push(currentUserId);
    }

    const validMembers = await User.find({ user_id: { $in: memberIds } });
    if (validMembers.length !== memberIds.length) {
      return errorResponse(res, 'One or more member IDs are invalid', 400);
    }

    const group = new Group({
      name,
      description: description || undefined,
      created_by: currentUserId,
      members: memberIds,
    });

    await group.save();

    const populatedGroup = await Group.findOne({ group_id: group.group_id })
      .populate('members', 'user_id full_name email phone_number')
      .populate('created_by', 'user_id full_name email phone_number');

    return successResponse(res, populatedGroup, 'Group created successfully', 201);
  } catch (error) {
    console.error('Create group error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return errorResponse(res, messages.join(', '), 400);
    }
    return errorResponse(res, 'Error creating group', 500);
  }
};

exports.getUserGroups = async (req, res) => {
  try {
    const currentUserId = req.user.user_id;

    const groups = await Group.find({ members: currentUserId })
      .populate('members', 'user_id full_name email phone_number')
      .populate('created_by', 'user_id full_name email phone_number')
      .sort({ created_at: -1 });

    return successResponse(res, groups, 'Groups fetched successfully', 200);
  } catch (error) {
    console.error('Get groups error:', error);
    return errorResponse(res, 'Error fetching groups', 500);
  }
};

exports.getGroupById = async (req, res) => {
  try {
    const { group_id } = req.params;
    const currentUserId = req.user.user_id;

    const group = await Group.findOne({ group_id })
      .populate('members', 'user_id full_name email phone_number')
      .populate('created_by', 'user_id full_name email phone_number');

    if (!group) {
      return errorResponse(res, 'Group not found', 404);
    }

    if (!group.members.some(m => m.user_id === currentUserId)) {
      return errorResponse(res, 'You are not a member of this group', 403);
    }

    return successResponse(res, group, 'Group fetched successfully', 200);
  } catch (error) {
    console.error('Get group error:', error);
    return errorResponse(res, 'Error fetching group', 500);
  }
};

exports.addMembers = async (req, res) => {
  try {
    const { group_id } = req.params;
    const { member_ids } = req.body;
    const currentUserId = req.user.user_id;

    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return errorResponse(res, 'Member IDs array is required', 400);
    }

    const group = await Group.findOne({ group_id });
    if (!group) {
      return errorResponse(res, 'Group not found', 404);
    }

    if (!group.members.includes(currentUserId)) {
      return errorResponse(res, 'Only group members can add other members', 403);
    }

    const uniqueMemberIds = [...new Set(member_ids)];
    const validMembers = await User.find({ user_id: { $in: uniqueMemberIds } });
    
    if (validMembers.length !== uniqueMemberIds.length) {
      return errorResponse(res, 'One or more member IDs are invalid', 400);
    }

    const newMembers = uniqueMemberIds.filter(id => !group.members.includes(id));
    if (newMembers.length === 0) {
      return errorResponse(res, 'All provided users are already members', 400);
    }

    group.members.push(...newMembers);
    await group.save();

    const populatedGroup = await Group.findOne({ group_id })
      .populate('members', 'user_id full_name email phone_number')
      .populate('created_by', 'user_id full_name email phone_number');

    return successResponse(res, populatedGroup, 'Members added successfully', 200);
  } catch (error) {
    console.error('Add members error:', error);
    return errorResponse(res, 'Error adding members', 500);
  }
};

exports.removeMember = async (req, res) => {
  try {
    const { group_id, member_id } = req.params;
    const currentUserId = req.user.user_id;

    const group = await Group.findOne({ group_id });
    if (!group) {
      return errorResponse(res, 'Group not found', 404);
    }

    if (!group.members.includes(currentUserId)) {
      return errorResponse(res, 'You are not a member of this group', 403);
    }

    if (group.created_by === member_id && group.members.length > 1) {
      return errorResponse(res, 'Group creator cannot be removed while other members exist', 400);
    }

    if (!group.members.includes(member_id)) {
      return errorResponse(res, 'User is not a member of this group', 400);
    }

    group.members = group.members.filter(id => id !== member_id);
    await group.save();

    const populatedGroup = await Group.findOne({ group_id })
      .populate('members', 'user_id full_name email phone_number')
      .populate('created_by', 'user_id full_name email phone_number');

    return successResponse(res, populatedGroup, 'Member removed successfully', 200);
  } catch (error) {
    console.error('Remove member error:', error);
    return errorResponse(res, 'Error removing member', 500);
  }
};
