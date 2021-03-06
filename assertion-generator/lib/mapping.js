const axios = require("axios").default

const mapping = {

    /**
     * @typedef Alignment Alignment object containing a competency and a confidence level.
     * @property {String} competency Competency being aligned.
     * @property {Number} weight Numeric weight of this competency alignment.
     */
    /**
     * Get an array of competency mappings from the given Experience Index entry.
     * @returns {Alignment[]} Array of competency alignments.
     */
    getCompetencyMappings: async(experience) => {
        
        let alignments = []

        if (Array.isArray(experience.educationalalignment))
            alignments = experience.educationalalignment

        else if (Array.isArray(experience.educationalAlignment))
            alignments = experience.educationalAlignment

        return alignments
    },

    /**
     * Get all relevant experiences for the given resolved xAPI statement.
     * @param {Object} statement Resolved and evidentiary xAPI statement.
     * @returns {Object} The experience associated with this statement.
     */
    getRelevantExperience: async(statement) => {

        let res = await axios.get(statement.object.id, {
            method: 'GET',
            headers: {  'Accept': 'application/json',}
        })
        let result = res.data
        
        if (Array.isArray(result.rows) && result.rows.length > 0)
            return result.rows[0]
        else
            return null
    },

    /**
     * Get all relevant experiences for the given resolved xAPI statement.
     * @param {Object} statement Resolved and evidentiary xAPI statement.
     */
    getStatementAlignments: async(statement) => {

        let experience = await mapping.getRelevantExperience(statement)
        if (experience)
            return await mapping.getCompetencyMappings(experience)
        else
            return null
    },

    
}

module.exports = mapping