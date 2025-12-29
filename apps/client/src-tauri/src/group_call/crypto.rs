use confide_sdk::crypto::group_call::{
    create_group_call, distribute_sender_key_to_participant, join_group_call, GroupCallAnnounce,
    GroupCallParticipant, GroupCallState, ParticipantId,
};
use confide_sdk::crypto::keys::DsaKeyPair;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroupCallResult {
    pub call_id: String,
    pub announcement: Vec<u8>,
    pub signature: Vec<u8>,
    pub initiator_ephemeral_public: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinGroupCallResult {
    pub encrypted_sender_key_bundle: Vec<u8>,
    pub signature: Vec<u8>,
    pub joiner_ephemeral_public: Vec<u8>,
}

pub fn create_group_call_crypto(
    user_id: Uuid,
    identity_public_key: Vec<u8>,
    dsa_secret_key: &[u8],
) -> Result<(CreateGroupCallResult, GroupCallState, DsaKeyPair), String> {
    let participant_id =
        ParticipantId::from_bytes(user_id.as_bytes()).map_err(|e| e.to_string())?;

    let dsa = DsaKeyPair::from_bytes(&[], dsa_secret_key).map_err(|e| e.to_string())?;

    let (state, announce) =
        create_group_call(participant_id, identity_public_key, &dsa).map_err(|e| e.to_string())?;

    let call_id = Uuid::from_bytes(announce.call_id.0);
    let initiator_ephemeral = state.our_ephemeral_public().to_vec();

    let announcement_bytes = bincode::serialize(&announce).map_err(|e| e.to_string())?;

    Ok((
        CreateGroupCallResult {
            call_id: call_id.to_string(),
            announcement: announcement_bytes,
            signature: announce.signature,
            initiator_ephemeral_public: initiator_ephemeral,
        },
        state,
        dsa,
    ))
}

pub fn join_group_call_crypto(
    user_id: Uuid,
    identity_public_key: Vec<u8>,
    dsa_secret_key: &[u8],
    announcement_bytes: &[u8],
) -> Result<(JoinGroupCallResult, GroupCallState, DsaKeyPair), String> {
    let participant_id =
        ParticipantId::from_bytes(user_id.as_bytes()).map_err(|e| e.to_string())?;

    let dsa = DsaKeyPair::from_bytes(&[], dsa_secret_key).map_err(|e| e.to_string())?;

    let announce: GroupCallAnnounce =
        bincode::deserialize(announcement_bytes).map_err(|e| e.to_string())?;

    let (state, join) = join_group_call(&announce, participant_id, identity_public_key, &dsa)
        .map_err(|e| e.to_string())?;

    let joiner_ephemeral = state.our_ephemeral_public().to_vec();

    let initiator_participant = GroupCallParticipant {
        participant_id: announce.initiator_id.clone(),
        identity_public_key: announce.initiator_identity_public.clone(),
        ephemeral_kem_public: announce.ephemeral_kem_public.clone(),
        joined_at: 0,
    };
    let distribution = distribute_sender_key_to_participant(&state, &initiator_participant, &dsa)
        .map_err(|e| e.to_string())?;

    let distribution_bytes = bincode::serialize(&distribution).map_err(|e| e.to_string())?;

    Ok((
        JoinGroupCallResult {
            encrypted_sender_key_bundle: distribution_bytes,
            signature: join.signature,
            joiner_ephemeral_public: joiner_ephemeral,
        },
        state,
        dsa,
    ))
}
