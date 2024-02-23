<?php

/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

class KnowledgeGraphApiSemanticProperties extends ApiBase {

	/**
	 * @inheritDoc
	 */
	public function isWriteMode() {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public function mustBePosted(): bool {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function execute() {
		$result = $this->getResult();
		$params = $this->extractRequestParams();
		$context = $this->getContext();
		$output = $context->getOutput();

		if ( empty( $params['pageids'] ) && empty( $params['title'] ) ) {
			$result->addValue( [ $this->getModuleName() ], 'error', 'empty parameters', ApiResult::NO_VALIDATE );
			return;
		}

		\KnowledgeGraph::initSMW();
		
		$data = [];
		if ( !empty( $params['pageids'] ) ) {
			$pageids = preg_split( '/\s*,\s*/', $params['pageids'], -1, PREG_SPLIT_NO_EMPTY );

			foreach ( $pageids as $articleId ) {
				$title = Title::newFromID( $articleId );
				if ( $title ) {
					$data[$title->getFullText()] = \KnowledgeGraph::getSemanticData( $title );
				}
			}
			$result->addValue( [ $this->getModuleName() ], 'data', $data, ApiResult::NO_VALIDATE );
			return;
		}

		$title = Title::newFromText( $params['title'] );
		$properties = \KnowledgeGraph::getSemanticData( $title );

		$data = [
			'pageid' => $title->getArticleID(),
			'properties' => $properties
		];
		
		$result->addValue( [ $this->getModuleName() ], 'data', $data, ApiResult::NO_VALIDATE );

	}

	/**
	 * @inheritDoc
	 */
	public function getAllowedParams() {
		return [
			'pageids' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false
			],
			'title' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false
			],
		];
	}

	/**
	 * @inheritDoc
	 */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * @inheritDoc
	 */
	protected function getExamplesMessages() {
		return [
			'action=knowledgegraph-semantic-properties'
			=> 'apihelp-knowledgegraph-semantic-properties-example-1'
		];
	}

}
