// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CredentialNFT is ERC721, Ownable {
    uint256 public nextTokenId;
    mapping(uint256 => string) private tokenUris;
    mapping(uint256 => string) public credentialTypes;

    constructor(address initialOwner)
        ERC721("Task Credential", "TCRED")
        Ownable(initialOwner)
    {}

    function safeMint(
        address to,
        string memory credentialType,
        string memory tokenURI_
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = ++nextTokenId;
        _safeMint(to, tokenId);
        tokenUris[tokenId] = tokenURI_;
        credentialTypes[tokenId] = credentialType;
        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        ownerOf(tokenId);
        return tokenUris[tokenId];
    }
}